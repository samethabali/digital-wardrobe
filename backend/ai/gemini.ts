import { GoogleGenAI, MediaResolution } from '@google/genai';
import crypto from 'crypto';
import {
  AiTask, modelsFor, thinkingConfigFor, DEFAULT_TIMEOUTS_MS, DEFAULT_TOTAL_BUDGET_MS,
  EMBEDDING_MODEL, EMBEDDING_DIMENSIONS,
} from './models.js';

export type AiErrorCode = 'unavailable' | 'bad_request' | 'blocked' | 'invalid_output' | 'timeout' | 'config';

export class AiError extends Error {
  code: AiErrorCode;
  constructor(code: AiErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

/** SDK'nın kullandığımız iki metodu; testlerde sahte istemciyle değiştirilir. */
export interface AiClient {
  generateContent(params: any): Promise<any>;
  embedContent(params: any): Promise<any>;
}

let client: AiClient | null = null;

function getClient(): AiClient {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyCD0LspfgsLR7GKEBeUIt8vgTBM14jd9pY';
    const genai = new GoogleGenAI({ apiKey });
    client = {
      generateContent: (params) => genai.models.generateContent(params),
      embedContent: (params) => genai.models.embedContent(params),
    };
  }
  return client;
}

export function setAiClientForTests(fake: AiClient | null) {
  client = fake;
}

export interface AiCallInfo {
  model: string;
  latencyMs: number;
  attempts: number;
  promptTokens: number | null;
  outputTokens: number | null;
  thoughtsTokens: number | null;
}

function logAiCall(entry: Record<string, unknown>) {
  // Tek satır JSON: Vercel loglarında filtrelenebilir
  console.log(JSON.stringify({ tag: 'ai', ...entry }));
}

function classifyError(err: any): 'retry' | 'bad_request' {
  const status = err?.status;
  const message = String(err?.message || '');
  if (err?.name === 'AbortError' || /aborted|timeout/i.test(message)) return 'retry';
  // 429 (kota), 5xx (yoğunluk), 404 (model yok / kapatıldı)
  if (status === 429 || (typeof status === 'number' && status >= 500) || status === 404) return 'retry';
  if (/429|quota|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded/i.test(message)) return 'retry';
  // 400 yalnızca model bulunamadı / desteklenmiyor diyorsa sıradaki model denenir;
  // diğer 400'ler (bozuk görsel, geçersiz istek) her modelde aynı sonucu verir.
  if ((status === 400 || status === undefined) && /not found|not supported|no longer available/i.test(message)) return 'retry';
  if (status === undefined) return 'retry';
  return 'bad_request';
}

const BLOCKED_REASONS = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'IMAGE_SAFETY']);

export interface GenerateJsonOptions {
  task: AiTask;
  label: string;
  contents: any;
  schema: object;
  systemInstruction?: string;
  mediaResolution?: MediaResolution;
  timeoutMs?: number;
  totalBudgetMs?: number;
  /** Belirli bir modelle başlamak için (ör. onarım isteğini ilk yanıtı veren modele göndermek) */
  preferModel?: string;
}

/**
 * JSON şemalı bir Gemini çağrısı yapar. Model zinciri, istek başına zaman aşımı, toplam süre bütçesi,
 * finishReason kontrolü ve JSON ayrıştırmayı tek yerde yönetir.
 */
export async function generateJson<T>(opts: GenerateJsonOptions): Promise<{ data: T; info: AiCallInfo }> {
  const ai = getClient();
  let models = modelsFor(opts.task);
  if (opts.preferModel && models.includes(opts.preferModel)) {
    models = [opts.preferModel, ...models.filter(m => m !== opts.preferModel)];
  }
  const perCallTimeout = opts.timeoutMs ?? DEFAULT_TIMEOUTS_MS[opts.task];
  const deadline = Date.now() + (opts.totalBudgetMs ?? DEFAULT_TOTAL_BUDGET_MS[opts.task]);
  let lastError: unknown = null;
  let attempts = 0;

  for (const model of models) {
    const remaining = deadline - Date.now();
    if (remaining < 1500) break;
    attempts++;
    const started = Date.now();
    try {
      const response = await ai.generateContent({
        model,
        contents: opts.contents,
        config: {
          ...(opts.systemInstruction ? { systemInstruction: opts.systemInstruction } : {}),
          responseMimeType: 'application/json',
          responseJsonSchema: opts.schema,
          ...(opts.mediaResolution ? { mediaResolution: opts.mediaResolution } : {}),
          ...(thinkingConfigFor(model, opts.task) ? { thinkingConfig: thinkingConfigFor(model, opts.task) } : {}),
          abortSignal: AbortSignal.timeout(Math.min(perCallTimeout, remaining)),
        },
      });

      const finishReason = response?.candidates?.[0]?.finishReason;
      const blockReason = response?.promptFeedback?.blockReason;
      if (blockReason || (finishReason && BLOCKED_REASONS.has(finishReason))) {
        logAiCall({ label: opts.label, model, ok: false, latencyMs: Date.now() - started, error: `blocked:${blockReason || finishReason}` });
        throw new AiError('blocked', 'İçerik güvenlik filtresine takıldı.');
      }

      const text: string | undefined = response?.text;
      let data: T;
      try {
        if (!text) throw new Error('boş yanıt');
        data = JSON.parse(text);
      } catch (parseErr) {
        // MAX_TOKENS veya bozuk JSON: sıradaki model denenir
        lastError = new AiError('invalid_output', `Model geçerli JSON döndürmedi (${finishReason || 'bilinmiyor'}).`);
        logAiCall({ label: opts.label, model, ok: false, latencyMs: Date.now() - started, error: `invalid_json:${finishReason}` });
        continue;
      }

      const usage = response?.usageMetadata || {};
      const info: AiCallInfo = {
        model,
        latencyMs: Date.now() - started,
        attempts,
        promptTokens: usage.promptTokenCount ?? null,
        outputTokens: usage.candidatesTokenCount ?? null,
        thoughtsTokens: usage.thoughtsTokenCount ?? null,
      };
      logAiCall({ label: opts.label, ok: true, ...info });
      return { data, info };
    } catch (err: any) {
      if (err instanceof AiError && err.code === 'blocked') throw err;
      lastError = err;
      const kind = classifyError(err);
      logAiCall({ label: opts.label, model, ok: false, latencyMs: Date.now() - started, status: err?.status, error: String(err?.message || err).slice(0, 200) });
      if (kind === 'bad_request') {
        throw new AiError('bad_request', 'Yapay zeka isteği geçersiz bulundu.');
      }
    }
  }

  if (Date.now() >= deadline - 1500) {
    throw new AiError('timeout', 'Yapay zeka zamanında yanıt veremedi. Lütfen biraz sonra tekrar dene.');
  }
  if (lastError instanceof AiError) throw lastError;
  throw new AiError('unavailable', 'Yapay zeka asistanı şu an yanıt veremiyor (modeller meşgul veya kota doldu). Lütfen daha sonra tekrar dene.');
}

export type EmbedInput = { text?: string; image?: { base64: string; mimeType: string } };

/**
 * Metin ve/veya görseli tek bir embedding'e dönüştürür (gemini-embedding-2 çok kipli girdileri birleştirir).
 * Başarısızlıkta null döner; embedding'ler hiçbir akışta zorunlu değildir.
 */
export async function embed(input: EmbedInput, label: string, timeoutMs = 10_000): Promise<number[] | null> {
  const contents: any[] = [];
  if (input.text) contents.push({ text: input.text });
  if (input.image) contents.push({ inlineData: { mimeType: input.image.mimeType, data: input.image.base64 } });
  if (contents.length === 0) return null;

  const started = Date.now();
  try {
    const ai = getClient();
    const response = await ai.embedContent({
      model: EMBEDDING_MODEL,
      contents,
      config: { outputDimensionality: EMBEDDING_DIMENSIONS, abortSignal: AbortSignal.timeout(timeoutMs) },
    });
    const values: number[] | undefined = response?.embeddings?.[0]?.values;
    if (!values || values.length !== EMBEDDING_DIMENSIONS) throw new Error('beklenmeyen embedding boyutu');
    logAiCall({ label, model: EMBEDDING_MODEL, ok: true, latencyMs: Date.now() - started });
    return normalizeVector(values);
  } catch (err: any) {
    logAiCall({ label, model: EMBEDDING_MODEL, ok: false, latencyMs: Date.now() - started, status: err?.status, error: String(err?.message || err).slice(0, 200) });
    return null;
  }
}

export function normalizeVector(values: number[]): number[] {
  const norm = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0)) || 1;
  return values.map(v => v / norm);
}

/** Normalize edilmiş iki vektörün kosinüs benzerliği. */
export function cosine(a: number[] | null | undefined, b: number[] | null | undefined): number | null {
  if (!a || !b || a.length !== b.length || a.length === 0) return null;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

export function embeddingCacheKey(text: string): string {
  return crypto.createHash('sha1').update(`${EMBEDDING_MODEL}:${EMBEDDING_DIMENSIONS}:${text}`).digest('hex');
}
