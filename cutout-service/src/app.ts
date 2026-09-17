// Arka plan kaldırma servisinin HTTP katmanı (model bağımlılığı dışarıdan verilir; testler sahte model kullanır).
import http from 'http';
import crypto from 'crypto';
import pngjs from 'pngjs';
import { alphaBounds, cleanCutoutAlpha } from '../../shared/cutoutMask.js';

const { PNG } = pngjs;

export interface RgbaImage {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

/** Görsel baytlarını alıp arka planı kaldırılmış RGBA görsel döndürür (orijinal çözünürlükte). */
export type RemoveBackground = (image: Buffer) => Promise<RgbaImage>;

export type ImageFetcher = (url: string) => Promise<{ ok: boolean; status: number; headers: { get(name: string): string | null }; arrayBuffer(): Promise<ArrayBuffer> }>;

export interface CutoutServerOptions {
  token: string;
  cloudName: string;
  removeBackground: RemoveBackground;
  /** Model hazır mı (sağlık kontrolü için) */
  isReady?: () => boolean;
  fetchImage?: ImageFetcher;
  /** Aynı anda kabul edilen iş (çalışan + bekleyen). Model ~7 GB bellek kullandığı için işler sırayla yürür. */
  maxInFlight?: number;
  log?: (entry: Record<string, unknown>) => void;
}

const MAX_BODY_BYTES = 4 * 1024;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const ALPHA_OPAQUE = 240;
const ALPHA_CLEAR = 12;

const defaultFetcher: ImageFetcher = (url) => fetch(url, { signal: AbortSignal.timeout(15_000), redirect: 'error' });

function sameToken(given: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/** Yalnızca kendi Cloudinary hesabımızdaki görseller işlenir (sunucu rastgele adreslere istek atmasın). */
export function isAllowedImageUrl(value: unknown, cloudName: string): value is string {
  if (typeof value !== 'string' || value.length > 1000) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' && url.pathname.startsWith(`/${cloudName}/image/upload/`);
  } catch {
    return false;
  }
}

/** Maskeyi temizler (askı, kulp), parçaya kırpar ve PNG'ye çevirir; görünür parça yoksa null. */
export function encodeCutout(image: RgbaImage): Buffer | null {
  const rgba = new Uint8ClampedArray(image.data);
  cleanCutoutAlpha(rgba, image.width, image.height);
  // Model parçanın içini ~245-254 opaklıkla verir: tam opak yapılır. Silik hale kaldırılır;
  // şeffaf piksellerin rengi sıfırlanır (görünmez, PNG'yi belirgin küçültür)
  for (let i = 3; i < rgba.length; i += 4) {
    if (rgba[i] >= ALPHA_OPAQUE) rgba[i] = 255;
    else if (rgba[i] <= ALPHA_CLEAR) rgba[i] = 0;
    if (rgba[i] === 0) { rgba[i - 3] = 0; rgba[i - 2] = 0; rgba[i - 1] = 0; }
  }
  const bounds = alphaBounds(rgba, image.width, image.height);
  if (!bounds) return null;
  const out = new PNG({ width: bounds.width, height: bounds.height });
  for (let y = 0; y < bounds.height; y++) {
    const from = ((bounds.y + y) * image.width + bounds.x) * 4;
    out.data.set(rgba.subarray(from, from + bounds.width * 4), y * bounds.width * 4);
  }
  return PNG.sync.write(out);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    // Sınır aşılırsa kalan veri okunup atılır; bağlantı kesilmez ki istemci 413 yanıtını alabilsin
    // (Caddy gövdeyi zaten 64 KB ile sınırlar)
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size <= MAX_BODY_BYTES) chunks.push(chunk);
    });
    req.on('end', () => {
      if (size > MAX_BODY_BYTES) reject(Object.assign(new Error('gövde çok büyük'), { status: 413 }));
      else resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

export function createCutoutServer(options: CutoutServerOptions): http.Server {
  const fetchImage = options.fetchImage ?? defaultFetcher;
  const maxInFlight = options.maxInFlight ?? 2;
  const log = options.log ?? ((entry) => console.log(JSON.stringify(entry)));
  let inFlight = 0;
  let queue: Promise<unknown> = Promise.resolve();

  // İşler sırayla yürür: bir önceki bitmeden model yeniden çağrılmaz
  const runExclusive = <T>(job: () => Promise<T>): Promise<T> => {
    const result = queue.then(job, job);
    queue = result.catch(() => undefined);
    return result;
  };

  const sendJson = (res: http.ServerResponse, status: number, body: object) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
  };

  return http.createServer(async (req, res) => {
    const started = Date.now();
    const url = req.url || '/';

    if (req.method === 'GET' && url === '/health') {
      return sendJson(res, 200, { ok: true, modelReady: options.isReady ? options.isReady() : true, inFlight });
    }
    if (req.method !== 'POST' || url !== '/cutout') return sendJson(res, 404, { error: 'Bulunamadı.' });

    const auth = req.headers.authorization;
    if (typeof auth !== 'string' || !auth.startsWith('Bearer ') || !sameToken(auth.slice(7), options.token)) {
      return sendJson(res, 401, { error: 'Yetkisiz.' });
    }
    if (options.isReady && !options.isReady()) return sendJson(res, 503, { error: 'Model henüz yüklenmedi.' });

    let imageUrl: unknown;
    try {
      imageUrl = JSON.parse(await readBody(req))?.imageUrl;
    } catch (err: any) {
      return sendJson(res, err?.status === 413 ? 413 : 400, { error: 'İstek gövdesi okunamadı.' });
    }
    if (!isAllowedImageUrl(imageUrl, options.cloudName)) return sendJson(res, 400, { error: 'Geçersiz görsel adresi.' });

    if (inFlight >= maxInFlight) {
      log({ tag: 'cutout', ok: false, reason: 'busy', inFlight });
      return sendJson(res, 503, { error: 'Meşgul.' });
    }
    inFlight++;
    try {
      const image = await fetchImage(imageUrl);
      const type = image.headers.get('content-type') || '';
      if (!image.ok || !type.startsWith('image/')) {
        log({ tag: 'cutout', ok: false, reason: 'download', status: image.status });
        return sendJson(res, 422, { error: 'Görsel indirilemedi.' });
      }
      const bytes = Buffer.from(await image.arrayBuffer());
      if (bytes.length > MAX_IMAGE_BYTES) return sendJson(res, 413, { error: 'Görsel çok büyük.' });

      const waitStarted = Date.now();
      const png = await runExclusive(async () => {
        const modelStarted = Date.now();
        const rgba = await options.removeBackground(bytes);
        const encoded = encodeCutout(rgba);
        log({ tag: 'cutout', stage: 'model', waitMs: modelStarted - waitStarted, modelMs: Date.now() - modelStarted });
        return encoded;
      });
      if (!png) return sendJson(res, 422, { error: 'Fotoğrafta ayrılabilecek bir parça bulunamadı.' });

      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': png.length });
      res.end(png);
      log({ tag: 'cutout', ok: true, totalMs: Date.now() - started, bytes: png.length });
    } catch (err: any) {
      log({ tag: 'cutout', ok: false, reason: 'error', error: String(err?.message || err).slice(0, 200) });
      if (!res.headersSent) sendJson(res, 500, { error: 'Arka plan kaldırılamadı.' });
    } finally {
      inFlight--;
    }
  });
}
