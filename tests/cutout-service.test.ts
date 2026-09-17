import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'net';
import pngjs from 'pngjs';
import { createCutoutServer, isAllowedImageUrl, RgbaImage } from '../cutout-service/src/app.js';

const { PNG } = pngjs;
const TOKEN = 't'.repeat(40);
const CLOUD = 'benimbulut';
const IMAGE_URL = `https://res.cloudinary.com/${CLOUD}/image/upload/f_jpg,q_90,w_1024/v1/digital_wardrobe/u/a.jpg`;

let base = '';
let modelCalls = 0;
let modelDelayMs = 0;
let nextImage: RgbaImage | null = null;
const server = createCutoutServer({
  token: TOKEN,
  cloudName: CLOUD,
  log: () => undefined,
  fetchImage: async () => ({ ok: true, status: 200, headers: { get: () => 'image/jpeg' }, arrayBuffer: async () => new ArrayBuffer(8) }),
  removeBackground: async () => {
    modelCalls++;
    await new Promise(r => setTimeout(r, modelDelayMs));
    return nextImage!;
  },
});

before(() => new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => {
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  resolve();
})));
after(() => new Promise<void>(resolve => server.close(() => resolve())));

const post = (body: unknown, token = TOKEN) => fetch(`${base}/cutout`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

/** 40x40 görsel: ortada 20x20 opak kare, köşede kopuk 2x2 nokta. */
function sampleCutout(): RgbaImage {
  const data = new Uint8ClampedArray(40 * 40 * 4);
  for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) {
    const inside = (x >= 10 && x < 30 && y >= 10 && y < 30) || (x < 2 && y < 2);
    // Model gibi: parçanın içi tam opak değil (250), arka plan silik (5)
    data.set([200, 50, 50, inside ? 250 : 5], (y * 40 + x) * 4);
  }
  return { data, width: 40, height: 40 };
}

test('servis: anahtarsız ve yabancı adresli istekler model çağrılmadan reddedilir', async () => {
  modelCalls = 0;
  assert.equal((await post({ imageUrl: IMAGE_URL }, 'yanlis')).status, 401);
  assert.equal((await post({ imageUrl: 'https://evil.example/a.jpg' })).status, 400);
  assert.equal((await post({ imageUrl: IMAGE_URL.replace(CLOUD, 'baskabulut') })).status, 400);
  assert.equal((await post('{bozuk')).status, 400);
  assert.equal((await post({ imageUrl: 'x'.repeat(10_000) })).status, 413);
  assert.equal((await fetch(`${base}/health`)).status, 200);
  assert.equal(modelCalls, 0);

  assert.equal(isAllowedImageUrl(`http://res.cloudinary.com/${CLOUD}/image/upload/a.jpg`, CLOUD), false, 'yalnızca https');
  assert.equal(isAllowedImageUrl(`https://res.cloudinary.com.evil.example/${CLOUD}/image/upload/a.jpg`, CLOUD), false);
});

test('servis: kopuk parçalar temizlenir, görsel parçaya kırpılmış PNG döner; boş maske 422', async () => {
  nextImage = sampleCutout();
  const res = await post({ imageUrl: IMAGE_URL });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  const png = PNG.sync.read(Buffer.from(await res.arrayBuffer()));
  assert.ok(png.width < 30 && png.height < 30, `kırpılmalı: ${png.width}x${png.height}`);
  const alphaAt = (x: number, y: number) => png.data[(y * png.width + x) * 4 + 3];
  assert.equal(alphaAt(Math.floor(png.width / 2), Math.floor(png.height / 2)), 255, 'neredeyse opak içi tam opak olmalı');
  assert.equal(alphaAt(0, 0), 0, 'silik arka plan tam şeffaf olmalı');
  assert.deepEqual([...png.data.subarray(0, 3)], [0, 0, 0], 'şeffaf pikselin rengi sıfırlanmalı');

  nextImage = { data: new Uint8ClampedArray(16), width: 2, height: 2 };
  assert.equal((await post({ imageUrl: IMAGE_URL })).status, 422);
});

test('servis: işler sırayla yürür, kapasite dolunca 503 döner', async () => {
  nextImage = sampleCutout();
  modelDelayMs = 150;
  modelCalls = 0;
  const started = Date.now();
  const results = await Promise.all([post({ imageUrl: IMAGE_URL }), post({ imageUrl: IMAGE_URL }), post({ imageUrl: IMAGE_URL })]);
  const elapsed = Date.now() - started;
  modelDelayMs = 0;
  assert.deepEqual(results.map(r => r.status).sort(), [200, 200, 503], 'varsayılan kapasite 2 (1 çalışan + 1 bekleyen)');
  assert.equal(modelCalls, 2);
  assert.ok(elapsed >= 300, `iki iş sırayla yürümeli (${elapsed} ms)`);
});
