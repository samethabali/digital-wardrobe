import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { startTestServer, TestContext, GRANTED, ownedItems, TEST_CLOUD } from './helpers/testServer.js';
import { NOTICE_VERSION } from '../shared/privacy.js';
import { WARDROBES } from '../scripts/eval/fixtures.js';

let t: TestContext;
before(async () => { t = await startTestServer(); });
after(async () => { await t.stop(); });

// Eski sürümde koda gömülü olan ve herkese açık depoda yayınlanmış yedek anahtar
const LEAKED_FALLBACK_SECRET = 'Hnc3Mxz9wO3WfpYRs4LTgme8bZXbsBAcknOunOfIPGsMqg3kqyjg08CHJBKp/olM';

test('yayınlanmış eski yedek anahtarla üretilen sahte token reddedilir', async () => {
  const { id } = await t.createUser('Kurban');
  const forged = jwt.sign({ id, email: 'x@y.z', username: 'x', name: 'x' }, LEAKED_FALLBACK_SECRET, { expiresIn: '1h' });
  const res = await t.api('GET', '/api/auth/me', { token: forged });
  assert.equal(res.status, 403);
});

test('JWT_SECRET tanımlı değilse korumalı uç noktalar 503 döner, sabit bir anahtara düşmez', async () => {
  const { token } = await t.createUser('Ayar');
  const saved = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  try {
    assert.equal((await t.api('GET', '/api/auth/me', { token })).status, 503);
    const forged = jwt.sign({ id: 'a' }, LEAKED_FALLBACK_SECRET);
    assert.equal((await t.api('GET', '/api/outfits', { token: forged })).status, 503);
    process.env.JWT_SECRET = 'kısa';
    assert.equal((await t.api('GET', '/api/auth/me', { token })).status, 503);
  } finally {
    process.env.JWT_SECRET = saved;
  }
  assert.equal((await t.api('GET', '/api/auth/me', { token })).status, 200);
});

test('koddaki gizli değer yedekleri kaldırılmış', async () => {
  const fs = await import('fs');
  const files = ['server.ts', 'backend/db.ts', 'backend/cloudinary.ts', 'backend/ai/gemini.ts', 'backend/http.ts', 'backend/config.ts'];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    assert.ok(!/mongodb(\+srv)?:\/\/[^'"`\s]*:[^'"`\s]*@/.test(source), `${file}: bağlantı adresinde şifre var`);
    assert.ok(!/AIza[0-9A-Za-z_-]{20,}/.test(source), `${file}: Gemini anahtarı var`);
    assert.ok(!source.includes(LEAKED_FALLBACK_SECRET), `${file}: JWT yedek anahtarı var`);
    assert.ok(!/api_secret:\s*process\.env\.[A-Z_]+\s*\|\|/.test(source), `${file}: Cloudinary secret yedeği var`);
  }
});

test('kayıt, giriş ve /me akışı; kısa şifre reddedilir', async () => {
  const short = await t.api('POST', '/api/auth/register', { body: { email: 'a@b.co', password: '123', name: 'A', username: 'kullanici' } });
  assert.equal(short.status, 400);
  const reg = await t.api('POST', '/api/auth/register', { body: { email: ' Yeni@Test.local ', password: 'gizli123', name: 'Yeni', username: 'Yeni Kullanici' } });
  assert.equal(reg.status, 200, JSON.stringify(reg.body));
  assert.equal(reg.body.user.username, 'yenikullanici');
  const login = await t.api('POST', '/api/auth/login', { body: { email: 'yeni@test.local', password: 'gizli123' } });
  assert.equal(login.status, 200);
  const me = await t.api('GET', '/api/auth/me', { token: login.body.token });
  assert.equal(me.status, 200);
  assert.equal(me.body.consents.personalization, false);
  assert.equal(me.body.noticeVersion, NOTICE_VERSION);
  assert.equal((await t.api('POST', '/api/auth/login', { body: { email: 'yeni@test.local', password: 'yanlis' } })).status, 401);
});

test('rıza vermek için güncel aydınlatma metni sürümü gerekir; geçersiz değerler reddedilir', async () => {
  const { token } = await t.createUser('Riza');
  assert.equal((await t.api('PUT', '/api/auth/consents', { token, body: { personalization: true } })).status, 409);
  assert.equal((await t.api('PUT', '/api/auth/consents', { token, body: { personalization: true, noticeVersion: '2020-01-01' } })).status, 409);
  assert.equal((await t.api('PUT', '/api/auth/consents', { token, body: { personalization: 'evet', noticeVersion: NOTICE_VERSION } })).status, 400);
  assert.equal((await t.api('PUT', '/api/auth/consents', { token, body: {} })).status, 400);

  const granted = await t.api('PUT', '/api/auth/consents', { token, body: { personalization: true, push: true, noticeVersion: NOTICE_VERSION } });
  assert.equal(granted.status, 200);
  assert.deepEqual(
    { p: granted.body.consents.personalization, c: granted.body.consents.personalColor, push: granted.body.consents.push, v: granted.body.consents.noticeVersion },
    { p: true, c: false, push: true, v: NOTICE_VERSION },
  );
  // Geri çekmek için sürüm gerekmez; eski istemcilerin POST'u da çalışır
  const withdrawn = await t.api('POST', '/api/auth/consents', { token, body: { push: false } });
  assert.equal(withdrawn.status, 200);
  assert.equal(withdrawn.body.consents.push, false);
  assert.equal(withdrawn.body.consents.personalization, true);
});

test('rıza geri çekilince ona bağlı veriler hemen silinir', async () => {
  const { id, token } = await t.createUser('Cekilme', {
    ...GRANTED(['personalization', 'personalColor', 'push']),
    styleProfile: { personalColor: { season: 'kış', undertone: 'soğuk', contrast: 'yüksek', bestColorFamilies: ['lacivert'], avoidColorFamilies: [], note: '', analyzedAt: new Date() } },
  });
  const { FeedbackEventModel, PreferenceProfileModel, DailyPickModel, PushSubscriptionModel, UserModel, WearLogModel } = t.models;
  await FeedbackEventModel.create({ userId: id, type: 'saved', itemIds: ['a', 'b'] });
  await PreferenceProfileModel.create({ userId: id, affinities: { item: { a: 2 }, colorFamily: {}, style: {}, fit: {}, pattern: {} } });
  await DailyPickModel.create({ userId: id, date: '2026-09-16', payload: {} });
  await PushSubscriptionModel.create({ userId: id, endpoint: 'https://push.example/abc', keys: { p256dh: 'x', auth: 'y' } });
  await WearLogModel.create({ userId: id, date: '2026-09-16', itemIds: ['a'] });

  const res = await t.api('PUT', '/api/auth/consents', { token, body: { personalization: false, personalColor: false, push: false } });
  assert.equal(res.status, 200);
  assert.equal(await FeedbackEventModel.countDocuments({ userId: id } as any), 0);
  assert.equal(await PreferenceProfileModel.countDocuments({ userId: id } as any), 0);
  assert.equal(await DailyPickModel.countDocuments({ userId: id } as any), 0);
  assert.equal(await PushSubscriptionModel.countDocuments({ userId: id } as any), 0);
  const user: any = await (UserModel as any).findById(id).lean();
  assert.ok(!user.styleProfile?.personalColor, 'kişisel renk sonucu silinmedi');
  // Giyim günlüğü rızaya bağlı değildir (kullanıcının kendi kaydı), silinmez
  assert.equal(await WearLogModel.countDocuments({ userId: id } as any), 1);
});

test('hesap silme: tüm koleksiyonlar temizlenir, görseller 100\'lük gruplarla silinir', async () => {
  const cloudinary = await import('../backend/cloudinary.js');
  const batches: string[][] = [];
  cloudinary.setImageDeleterForTests(async ids => { batches.push(ids); });

  const owner = await t.createUser('Silinen', GRANTED(['personalization', 'push']));
  const friend = await t.createUser('Arkadas');
  const other = await t.createUser('Baskasi');
  const { ItemModel, OutfitModel, WearLogModel, CollabSessionModel, PushSubscriptionModel, FeedbackEventModel, PreferenceProfileModel, DailyPickModel, UserModel } = t.models;

  const base = WARDROBES.buyuk.slice(0, 1);
  const docs = Array.from({ length: 130 }, (_, i) => ({
    ...ownedItems(base, owner.id, `n${i}_`)[0],
    cutoutImagePath: i < 20 ? `https://res.cloudinary.com/${TEST_CLOUD}/image/upload/v2/digital_wardrobe/${owner.id}/c${i}_cutout.png` : undefined,
  }));
  // Başka kullanıcının klasörüne işaret eden kayıt silinmemeli
  docs.push({ ...docs[0], id: 'foreign', imagePath: `https://res.cloudinary.com/${TEST_CLOUD}/image/upload/v1/digital_wardrobe/${other.id}/x.jpg`, cutoutImagePath: undefined });
  await ItemModel.insertMany(docs);
  await ItemModel.create(ownedItems(base, other.id, 'o_')[0]);
  await OutfitModel.create({ id: 'o1', userId: owner.id, items: ['n0_item_001'] });
  await WearLogModel.create({ userId: owner.id, date: '2026-09-10', itemIds: ['n0_item_001'] });
  await CollabSessionModel.create({ id: 'c1', initiatorId: owner.id, friendId: friend.id });
  await CollabSessionModel.create({ id: 'c2', initiatorId: friend.id, friendId: owner.id });
  await CollabSessionModel.create({ id: 'c3', initiatorId: friend.id, friendId: other.id });
  await PushSubscriptionModel.create({ userId: owner.id, endpoint: 'https://push.example/owner', keys: { p256dh: 'x', auth: 'y' } });
  await FeedbackEventModel.create({ userId: owner.id, type: 'worn', itemIds: ['n0_item_001'] });
  await PreferenceProfileModel.create({ userId: owner.id });
  await DailyPickModel.create({ userId: owner.id, date: '2026-09-16', payload: {} });

  const res = await t.api('DELETE', '/api/auth/profile', { token: owner.token });
  cloudinary.setImageDeleterForTests(async () => undefined);
  assert.equal(res.status, 200);

  const deletedIds = batches.flat();
  assert.equal(deletedIds.length, 150, 'görsel + arka planı kaldırılmış kopya sayısı');
  assert.ok(batches.every(b => b.length <= 100), `grup boyutları: ${batches.map(b => b.length)}`);
  assert.ok(deletedIds.every(pid => pid.startsWith(`digital_wardrobe/${owner.id}/`)), 'başka kullanıcının görseli silinmeye çalışıldı');

  for (const [name, model, filter] of [
    ['Item', ItemModel, { userId: owner.id }],
    ['Outfit', OutfitModel, { userId: owner.id }],
    ['WearLog', WearLogModel, { userId: owner.id }],
    ['PushSubscription', PushSubscriptionModel, { userId: owner.id }],
    ['FeedbackEvent', FeedbackEventModel, { userId: owner.id }],
    ['PreferenceProfile', PreferenceProfileModel, { userId: owner.id }],
    ['DailyPick', DailyPickModel, { userId: owner.id }],
    ['CollabSession', CollabSessionModel, { $or: [{ initiatorId: owner.id }, { friendId: owner.id }] }],
    ['User', UserModel, { _id: owner.id }],
  ] as const) {
    assert.equal(await (model as any).countDocuments(filter), 0, `${name} kaydı kaldı`);
  }
  assert.equal(await ItemModel.countDocuments({ userId: other.id } as any), 1);
  assert.equal(await CollabSessionModel.countDocuments({ id: 'c3' } as any), 1);
});

test('görsel silme başarısız olsa da veritabanı temizliği tamamlanır', async () => {
  const cloudinary = await import('../backend/cloudinary.js');
  cloudinary.setImageDeleterForTests(async () => { throw new Error('Cloudinary kapalı'); });
  const owner = await t.createUser('Hata');
  await t.models.ItemModel.create(ownedItems(WARDROBES.kucuk.slice(0, 1), owner.id)[0]);
  const res = await t.api('DELETE', '/api/auth/profile', { token: owner.token });
  cloudinary.setImageDeleterForTests(async () => undefined);
  assert.equal(res.status, 200);
  assert.equal(await t.models.ItemModel.countDocuments({ userId: owner.id } as any), 0);
  assert.equal(await t.models.UserModel.countDocuments({ _id: owner.id } as any), 0);
});

test('bilinmeyen uç nokta JSON 404, bozuk gövde 400 döner', async () => {
  assert.equal((await t.api('GET', '/api/yok')).status, 404);
  const res = await fetch(`${t.baseUrl}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bozuk' });
  assert.equal(res.status, 400);
});
