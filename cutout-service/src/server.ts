// Arka plan kaldırma servisi: BiRefNet lite (MIT) modelini bellekte tutar, görselleri sırayla işler.
// Çalıştırma ve kurulum: cutout-service/README.md
import { createCutoutServer, RemoveBackground } from './app.js';

const MODEL_ID = 'onnx-community/BiRefNet_lite-ONNX';
// Model kütüphanesi yalnızca serviste kurulu; ana projenin tip kontrolü onu çözmeye çalışmasın diye adı değişkende
const MODEL_LIBRARY = '@huggingface/transformers';

function required(name: string, minLength = 1): string {
  const value = process.env[name]?.trim();
  if (!value || value.length < minLength) {
    console.error(`${name} ortam değişkeni eksik${minLength > 1 ? ` (en az ${minLength} karakter)` : ''}.`);
    process.exit(1);
  }
  return value;
}

const token = required('CUTOUT_SERVICE_TOKEN', 32);
const cloudName = required('CLOUDINARY_CLOUD_NAME');
const port = Number(process.env.PORT || 8080);
const threads = Number(process.env.MODEL_THREADS || 2);

let ready = false;
let removeBackground: RemoveBackground = async () => { throw new Error('model hazır değil'); };

async function loadModel() {
  const started = Date.now();
  const { pipeline, RawImage, env }: any = await import(MODEL_LIBRARY);
  if (process.env.MODEL_CACHE_DIR) env.cacheDir = process.env.MODEL_CACHE_DIR;
  const remover = await pipeline('background-removal', MODEL_ID, {
    dtype: 'fp32',
    device: 'cpu',
    // Bellek havuzu kapalı: açıkken farklı görsel boyutlarında havuz büyüyüp 12 GB'ı aşıyor ve sunucu swap'e düşüyordu
    // (istek 20 sn'den 60 sn'ye çıkıyordu). Kapalıyken zirve ~6.8 GB ve süre sabit.
    session_options: { intraOpNumThreads: threads, interOpNumThreads: 1, enableCpuMemArena: false, enableMemPattern: false },
  });

  removeBackground = async (bytes) => {
    const image = await RawImage.fromBlob(new Blob([bytes]));
    const result = await remover(image);
    const output = Array.isArray(result) ? result[0] : result;
    const rgba = output.channels === 4 ? output : output.rgba();
    return { data: rgba.data, width: rgba.width, height: rgba.height };
  };

  // Isınma gerçek boyutta yapılır: model belleği şimdi ayrılır, ilk gerçek istek diğerleri kadar hızlı olur
  await remover(new RawImage(new Uint8ClampedArray(1024 * 1024 * 3).fill(128), 1024, 1024, 3));
  ready = true;
  console.log(JSON.stringify({ tag: 'startup', model: MODEL_ID, threads, loadMs: Date.now() - started }));
}

const server = createCutoutServer({ token, cloudName, removeBackground: (bytes) => removeBackground(bytes), isReady: () => ready });
// Yalnızca yerel arayüz: dışarıya Caddy (HTTPS) üzerinden açılır
server.listen(port, '127.0.0.1', () => console.log(JSON.stringify({ tag: 'listen', port })));

loadModel().catch((err) => {
  console.error('Model yüklenemedi:', err);
  process.exit(1);
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
