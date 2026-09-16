import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pngjs from 'pngjs';
import { startTestServer, TestContext, ownedItems, scriptedAi, TEST_CLOUD, unavailableAi, fakeVector } from './helpers/testServer.js';
import { WARDROBES } from '../scripts/eval/fixtures.js';

const { PNG } = pngjs;
let t: TestContext;
let uploads = 0;

before(async () => {
  t = await startTestServer({
    // Cloudinary yerine: dosyanın kullanıcının klasörüne yüklendiğini varsayar
    uploadMiddleware: (req: any, _res: any, next: any) => {
      uploads++;
      req.file = { path: `https://res.cloudinary.com/${TEST_CLOUD}/image/upload/v1/digital_wardrobe/${req.user.id}/foto_${uploads}.jpg`, originalname: 'Mavi Gömlek.jpg' };
      next();
    },
  });
});
after(async () => { await t.stop(); });

function solidPng(width: number, height: number, rgba: [number, number, number, number]): Buffer {
  const png = new PNG({ width, height });
  for (let i = 0; i < width * height; i++) png.data.set(rgba, i * 4);
  return PNG.sync.write(png);
}

const gemini = () => import('../backend/ai/gemini.js');
const cloudinary = () => import('../backend/cloudinary.js');

function serveImage(buffer: Buffer, mime = 'image/png') {
  return cloudinary().then(c => c.setImageFetcherForTests(async () => ({
    ok: true,
    headers: { get: () => mime },
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
  })));
}

const VISION_RESULT = {
  isClothing: true, name: 'Mavi keten gömlek', category: 'top', subCategory: 'gömlek', color: 'mavi', colorFamily: 'mavi',
  colorHex: '#3366cc', secondaryColors: [], material: 'keten', pattern: 'düz', fit: 'normal', style: 'smart-casual',
  formality: 4, warmth: 2, waterResistant: false, layerRole: 'mid', seasons: ['ilkbahar', 'yaz'],
};

test('parça güncelleme: yeni alanlar düzenlenebilir, sunucu alanları ve geçersiz değerler reddedilir', async () => {
  const u = await t.createUser('Duzenle');
  const [doc] = ownedItems(WARDROBES.kucuk.slice(0, 1), u.id);
  await t.models.ItemModel.create({ ...doc, embedding: fakeVector('x'), embeddingModel: 'gemini-embedding-2' });
  const other = await t.createUser('Saldirgan');

  const ok = await t.api('PUT', `/api/wardrobe/${doc.id}`, {
    token: u.token,
    body: { formality: 5, warmth: 1, colorFamily: 'bordo', waterResistant: true, seasons: ['yaz'], price: 1250, category: 'onepiece', userId: other.id, imagePath: 'https://evil.example/x.jpg', aiAnalyzed: false, embedding: [1, 2] },
  });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const saved: any = await t.models.ItemModel.findOne({ id: doc.id } as any).select('+embedding').lean();
  assert.equal(saved.formality, 5);
  assert.equal(saved.colorFamily, 'bordo');
  assert.equal(saved.price, 1250);
  assert.equal(saved.userId.toString(), u.id, 'sahiplik değişmemeli');
  assert.equal(saved.imagePath, doc.imagePath);
  assert.ok(!saved.embedding, 'tarif değişince embedding geçersiz sayılmalı');
  assert.ok(saved.weatherMatch.includes('hot'), `weatherMatch yeniden türetilmeli: ${saved.weatherMatch}`);
  assert.ok(!('embedding' in ok.body.item));

  for (const body of [{ formality: 7 }, { colorFamily: 'fuşya' }, { category: 'şapka' }, { seasons: ['kışın'] }, { price: -5 }, { waterResistant: 'evet' }, { colorHex: 'mavi' }, { name: 'x'.repeat(300) }]) {
    assert.equal((await t.api('PUT', `/api/wardrobe/${doc.id}`, { token: u.token, body })).status, 400, JSON.stringify(body));
  }
  assert.equal((await t.api('PUT', `/api/wardrobe/${doc.id}`, { token: other.token, body: { name: 'çalıntı' } })).status, 404);
});

test('yükleme: analizdeki yeni alanlar kaydedilir, embedding hesaplanır, aynı parça ikinci kez eklenince uyarılır', async () => {
  const u = await t.createUser('Yukleyen');
  await serveImage(solidPng(8, 8, [40, 80, 200, 255]), 'image/jpeg');
  (await gemini()).setAiClientForTests(scriptedAi(
    params => (params.config?.responseJsonSchema?.properties?.isClothing ? VISION_RESULT : null),
    params => params.contents.find((c: any) => c.inlineData)?.inlineData.data || 'metin',
  ));

  const first = await t.api('POST', '/api/wardrobe/upload', { token: u.token, body: { itemData: JSON.stringify({ name: 'Favori gömleğim' }), autoAnalyze: 'true' } });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.item.name, 'Favori gömleğim', 'kullanıcının verdiği ad korunur');
  assert.equal(first.body.item.formality, 4);
  assert.equal(first.body.item.colorFamily, 'mavi');
  assert.deepEqual(first.body.item.seasons, ['ilkbahar', 'yaz']);
  assert.ok(first.body.item.imagePath.includes('/upload/f_auto,q_auto,w_1200/'));
  assert.deepEqual(first.body.similarItems, []);
  const stored: any = await t.models.ItemModel.findOne({ id: first.body.item.id } as any).select('+embedding +embeddingModel').lean();
  assert.equal(stored.embedding.length, 768);
  assert.equal(stored.embeddingModel, 'gemini-embedding-2');

  const second = await t.api('POST', '/api/wardrobe/upload', { token: u.token, body: { itemData: JSON.stringify({ category: 'top', subCategory: 'gömlek', color: 'mavi' }), autoAnalyze: 'false' } });
  assert.equal(second.status, 200);
  assert.equal(second.body.similarItems.length, 1);
  assert.equal(second.body.similarItems[0].id, first.body.item.id);
  assert.ok(second.body.similarItems[0].similarity >= 0.9);

  (await gemini()).setAiClientForTests(unavailableAi);
});

test('yükleme: geçersiz parça bilgisi 400 döner ve yüklenen görsel geri silinir; AI kapalıyken parça yine eklenir', async () => {
  const u = await t.createUser('Gecersiz');
  const deleted: string[] = [];
  (await cloudinary()).setImageDeleterForTests(async ids => { deleted.push(...ids); });
  const bad = await t.api('POST', '/api/wardrobe/upload', { token: u.token, body: { itemData: JSON.stringify({ formality: 99 }) } });
  assert.equal(bad.status, 400);
  assert.equal(deleted.length, 1);
  assert.ok(deleted[0].startsWith(`digital_wardrobe/${u.id}/`));
  const broken = await t.api('POST', '/api/wardrobe/upload', { token: u.token, body: { itemData: '{bozuk' } });
  assert.equal(broken.status, 400);
  (await cloudinary()).setImageDeleterForTests(async () => undefined);

  await serveImage(solidPng(4, 4, [0, 0, 0, 255]));
  const noAi = await t.api('POST', '/api/wardrobe/upload', { token: u.token, body: { itemData: '{}', autoAnalyze: 'true' } });
  assert.equal(noAi.status, 200, JSON.stringify(noAi.body));
  assert.equal(noAi.body.item.category, 'top');
  assert.equal(noAi.body.item.name, 'Mavi Gömlek');
  assert.ok(noAi.body.warnings.length > 0);
});

test('parça silme: görsel ve arka planı kaldırılmış kopyası silinir, kombinlerden çıkarılır', async () => {
  const u = await t.createUser('Silen');
  const [doc, other] = ownedItems(WARDROBES.kucuk.slice(0, 2), u.id);
  const cutout = `https://res.cloudinary.com/${TEST_CLOUD}/image/upload/v2/digital_wardrobe/${u.id}/x_cutout.png`;
  await t.models.ItemModel.insertMany([{ ...doc, cutoutImagePath: cutout }, other]);
  await t.models.OutfitModel.create({ id: 'o_sil', userId: u.id, items: [doc.id, other.id] });
  const deleted: string[] = [];
  (await cloudinary()).setImageDeleterForTests(async ids => { deleted.push(...ids); });

  const res = await t.api('DELETE', `/api/wardrobe/${doc.id}`, { token: u.token });
  (await cloudinary()).setImageDeleterForTests(async () => undefined);
  assert.equal(res.status, 200);
  assert.equal(deleted.length, 2);
  const outfit: any = await t.models.OutfitModel.findOne({ id: 'o_sil' } as any).lean();
  assert.deepEqual(outfit.items, [other.id]);
});

test('arka plan kaldırma: maske uygulanır, şeffaf PNG kullanıcının klasörüne yüklenir', async () => {
  const u = await t.createUser('Kesen');
  const [doc] = ownedItems(WARDROBES.kucuk.slice(0, 1), u.id);
  await t.models.ItemModel.create(doc);
  await serveImage(solidPng(20, 20, [200, 30, 30, 255]));
  const mask = new PNG({ width: 10, height: 10 });
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) mask.data.set(x < 5 ? [255, 255, 255, 255] : [0, 0, 0, 255], (y * 10 + x) * 4);
  (await gemini()).setAiClientForTests(scriptedAi(params => (params.config?.responseJsonSchema?.properties?.masks
    ? { masks: [{ box_2d: [0, 0, 1000, 1000], label: 'gömlek', mask: `data:image/png;base64,${PNG.sync.write(mask).toString('base64')}` }] }
    : null)));
  let uploaded: { dataUri: string; folder: string } | null = null;
  (await cloudinary()).setImageUploaderForTests(async (dataUri, opts) => {
    uploaded = { dataUri, folder: opts.folder };
    return `https://res.cloudinary.com/${TEST_CLOUD}/image/upload/v3/${opts.folder}/${opts.public_id}.png`;
  });

  const res = await t.api('POST', `/api/wardrobe/${doc.id}/cutout`, { token: u.token });
  (await gemini()).setAiClientForTests(unavailableAi);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.ok(res.body.item.cutoutImagePath.endsWith('_cutout.png'));
  assert.equal(uploaded!.folder, `digital_wardrobe/${u.id}`);
  const png = PNG.sync.read(Buffer.from(uploaded!.dataUri.split(',')[1], 'base64'));
  const alphaAt = (x: number, y: number) => png.data[(y * png.width + x) * 4 + 3];
  assert.equal(alphaAt(1, 10), 255, 'maskenin içi opak');
  assert.equal(alphaAt(png.width - 2, 10), 0, 'maskenin dışı şeffaf');

  const failing = await t.api('POST', `/api/wardrobe/${doc.id}/cutout`, { token: u.token });
  assert.equal(failing.status, 503, 'AI yanıt vermezse anlamlı hata');
  assert.equal((await t.api('POST', '/api/wardrobe/yok/cutout', { token: u.token })).status, 404);
});

test('"Bu parçayla ne giyerim?": seçilen parça her kombinde, AI kotası harcanmaz', async () => {
  const u = await t.createUser('Eslestir');
  const docs = ownedItems(WARDROBES.orta, u.id);
  await t.models.ItemModel.insertMany(docs);
  const jean = docs.find(d => d.subCategory === 'koyu jean')!;
  let aiCalls = 0;
  (await gemini()).setAiClientForTests({ generateContent: async () => { aiCalls++; throw new Error('çağrılmamalı'); }, embedContent: async () => { aiCalls++; throw new Error('çağrılmamalı'); } });

  const res = await t.api('POST', `/api/wardrobe/${jean.id}/pairings`, { token: u.token, body: { ignoreWeather: true } });
  (await gemini()).setAiClientForTests(unavailableAi);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.ok(res.body.outfits.length >= 1);
  assert.ok(res.body.outfits.every((o: any) => o.itemIds.includes(jean.id)));
  assert.equal(res.body.model, null);
  assert.equal(aiCalls, 0);
  assert.equal((await t.api('POST', '/api/wardrobe/baskasinin_parcasi/pairings', { token: u.token, body: {} })).status, 404);
});

test('benzer parçalar ve embedding tamamlama uç noktaları', async () => {
  const u = await t.createUser('Benzer');
  const docs = ownedItems(WARDROBES.kucuk.slice(0, 3), u.id);
  await t.models.ItemModel.insertMany(docs.map(d => ({ ...d, category: 'top' })));
  await serveImage(solidPng(4, 4, [1, 2, 3, 255]));
  (await gemini()).setAiClientForTests(scriptedAi(() => null, () => 'aynı görsel'));

  const before = await t.api('GET', `/api/wardrobe/${docs[0].id}/similar`, { token: u.token });
  assert.deepEqual(before.body, { similarItems: [], embedded: false });

  const backfill = await t.api('POST', '/api/wardrobe/embeddings/backfill', { token: u.token });
  assert.equal(backfill.status, 200, JSON.stringify(backfill.body));
  assert.equal(backfill.body.computed, 3);
  assert.equal(backfill.body.remaining, 0);

  const after = await t.api('GET', `/api/wardrobe/${docs[0].id}/similar`, { token: u.token });
  (await gemini()).setAiClientForTests(unavailableAi);
  assert.equal(after.body.embedded, true);
  assert.equal(after.body.similarItems.length, 2);
  assert.ok(after.body.similarItems.every((s: any) => s.id !== docs[0].id));
});

test('kapsül analizi kategori doğrulaması; gardırop sayfalaması sınırlı', async () => {
  const u = await t.createUser('Kapsul');
  await t.models.ItemModel.insertMany(ownedItems(WARDROBES.kucuk, u.id));
  assert.equal((await t.api('GET', '/api/capsule-analysis?category=$ne', { token: u.token })).status, 400);
  const capsule = await t.api('GET', '/api/capsule-analysis?category=shoes', { token: u.token });
  assert.equal(capsule.status, 200, JSON.stringify(capsule.body));
  assert.ok(capsule.body.currentOutfitCount > 0);

  const page = await t.api('GET', '/api/wardrobe?page=1&limit=100000', { token: u.token });
  assert.equal(page.body.items.length, Math.min(100, WARDROBES.kucuk.length));

  const other = await t.createUser('Baska');
  await t.models.ItemModel.create(ownedItems(WARDROBES.kucuk.slice(0, 1), other.id, 'z_')[0]);
  const byIds = await t.api('GET', `/api/wardrobe?ids=${WARDROBES.kucuk[0].id},${WARDROBES.kucuk[1].id},z_${WARDROBES.kucuk[0].id},{$ne:1}`, { token: u.token });
  assert.deepEqual(byIds.body.items.map((i: any) => i.id).sort(), [WARDROBES.kucuk[0].id, WARDROBES.kucuk[1].id].sort(), 'yalnızca kendi parçaları');
});
