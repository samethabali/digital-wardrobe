import { ThinkingLevel } from '@google/genai';

/**
 * Görev bazlı model listeleri. Hepsi Gemini API ücretsiz katmanında kullanılabilen modellerdir
 * (16 Eylül 2026 itibarıyla fiyat sayfası). Liste sırası önceliktir; 429/503/404/zaman aşımında
 * sıradaki modele geçilir. Her modelin ücretsiz kotası ayrı olduğu için yedek zincir toplam
 * günlük kapasiteyi de artırır.
 *
 * Ölçülen gecikmeler (ücretsiz katman, küçük istek): 3.6 Flash ~1 sn, 3.5/3.1 Flash-Lite ~1 sn,
 * 3.8 Flash ve flash-latest ~40 sn. Yavaş modeller bu yüzden listelerin sonunda.
 * `-latest` takma adları habersiz değişebildiği için yalnızca son çare.
 *
 * Canlıda yeniden deploy etmeden değiştirmek için: GEMINI_MODELS_STYLIST="a,b,c" gibi.
 */
export type AiTask = 'stylist' | 'vision' | 'light' | 'analysis' | 'segmentation';

const DEFAULT_MODELS: Record<AiTask, string[]> = {
  // Kombin seçimi ve açıklama, beraber kombin, kapsül önerisi
  stylist: ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'],
  // Kıyafet fotoğrafı etiketleme
  vision: ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.6-flash', 'gemini-flash-lite-latest'],
  // Serbest metin ayrıştırma, tercih özeti gibi küçük işler
  light: ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest'],
  // Kişisel renk analizi gibi görsel + muhakeme gerektiren işler
  analysis: ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-3.5-flash-lite'],
  // Görüntü segmentasyonu yalnızca 2.5 Flash'ta destekleniyor (Gemini 3 kılavuzu)
  segmentation: ['gemini-2.5-flash'],
};

const ENV_KEYS: Record<AiTask, string> = {
  stylist: 'GEMINI_MODELS_STYLIST',
  vision: 'GEMINI_MODELS_VISION',
  light: 'GEMINI_MODELS_LIGHT',
  analysis: 'GEMINI_MODELS_ANALYSIS',
  segmentation: 'GEMINI_MODELS_SEGMENTATION',
};

export function modelsFor(task: AiTask): string[] {
  const fromEnv = process.env[ENV_KEYS[task]];
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.split(',').map(m => m.trim()).filter(Boolean);
  }
  return DEFAULT_MODELS[task];
}

export const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2';
export const EMBEDDING_DIMENSIONS = 768;

// Görev başına düşünme düzeyi. Gemini 3 kılavuzu temperature'ın varsayılanda bırakılmasını öneriyor;
// bu yüzden hiçbir çağrıda temperature ayarlanmıyor.
const TASK_THINKING: Record<AiTask, ThinkingLevel> = {
  stylist: ThinkingLevel.LOW,
  vision: ThinkingLevel.MINIMAL,
  light: ThinkingLevel.MINIMAL,
  analysis: ThinkingLevel.LOW,
  segmentation: ThinkingLevel.MINIMAL,
};

const BUDGET_FOR_LEVEL: Record<string, number> = {
  [ThinkingLevel.MINIMAL]: 0,
  [ThinkingLevel.LOW]: 512,
  [ThinkingLevel.MEDIUM]: 2048,
  [ThinkingLevel.HIGH]: 8192,
};

/**
 * Modele uygun düşünme ayarı: Gemini 3.x `thinkingLevel`, 2.5 `thinkingBudget` kullanır;
 * ikisi aynı istekte kullanılamaz. Takma adların hangi nesle işaret ettiği bilinmediği için ayar verilmez.
 */
export function thinkingConfigFor(model: string, task: AiTask) {
  const level = TASK_THINKING[task];
  if (/^gemini-3/.test(model)) return { thinkingLevel: level };
  if (/^gemini-2\.5/.test(model)) return { thinkingBudget: BUDGET_FOR_LEVEL[level] };
  return undefined;
}

export const DEFAULT_TIMEOUTS_MS: Record<AiTask, number> = {
  stylist: 20_000,
  vision: 15_000,
  light: 8_000,
  analysis: 25_000,
  segmentation: 30_000,
};

// Bir işin tüm yedek zinciri için toplam süre bütçesi (Vercel fonksiyon süresinin altında kalmalı)
export const DEFAULT_TOTAL_BUDGET_MS: Record<AiTask, number> = {
  stylist: 40_000,
  vision: 30_000,
  light: 12_000,
  analysis: 45_000,
  segmentation: 45_000,
};
