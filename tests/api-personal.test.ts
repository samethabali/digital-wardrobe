import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, TestContext, ownedItems, GRANTED, scriptedAi, unavailableAi } from './helpers/testServer.js';
import { WARDROBES } from '../scripts/eval/fixtures.js';
import { addDays, localDate, localDateTime } from '../backend/time.js';
import { NOTICE_VERSION } from '../shared/privacy.js';

let t: TestContext;
before(async () => { t = await startTestServer(); });
after(async () => { await t.stop(); });

const weatherModule = () => import('../backend/weather.js');
const gemini = () => import('../backend/ai/gemini.js');
const push = () => import('../backend/push.js');

afterEach(async () => {
  (await weatherModule()).setWeatherFetcherForTests(async () => { throw new Error('ağ kapalı'); });
  (await gemini()).setAiClientForTests(unavailableAi);
  (await push()).setPushSenderForTests(null);
});

/** Open-Meteo biçiminde, bugünden itibaren 16 günlük sabit hava durumu. */
function forecast(feelsLike: number, code: number, precip = 10) {
  const today = localDate();
  const now = localDateTime();
  const days = Array.from({ length: 16 }, (_, i) => addDays(today, i));
  const hours = days.flatMap(d => Array.from({ length: 24 }, (_, h) => `${d}T${String(h).padStart(2, '0')}:00`));
  const n = hours.length;
  return {
    current: { time: `${now.slice(0, 13)}:00`, temperature_2m: feelsLike + 2, apparent_temperature: feelsLike, weather_code: code, wind_speed_10m: 10 },
    hourly: {
      time: hours,
      temperature_2m: Array(n).fill(feelsLike + 2), apparent_temperature: Array(n).fill(feelsLike),
      precipitation_probability: Array(n).fill(precip), weather_code: Array(n).fill(code), wind_speed_10m: Array(n).fill(10),
    },
    daily: {
      time: days,
      temperature_2m_max: Array(16).fill(feelsLike + 5), temperature_2m_min: Array(16).fill(feelsLike - 3),
      apparent_temperature_max: Array(16).fill(feelsLike + 3), apparent_temperature_min: Array(16).fill(feelsLike - 5),
      precipitation_probability_max: Array(16).fill(precip), weather_code: Array(16).fill(code),
    },
  };
}

async function useWeather(feelsLike: number, code: number, precip = 10) {
  const calls: string[] = [];
  (await weatherModule()).setWeatherFetcherForTests(async url => {
    calls.push(url);
    if (url.includes('geocoding')) return { ok: true, status: 200, json: async () => ({ results: [] }) };
    return { ok: true, status: 200, json: async () => forecast(feelsLike, code, precip) };
  });
  return calls;
}

async function userWithWardrobe(name: string, extra: Record<string, unknown> = {}, prefix = '') {
  const u = await t.createUser(name, extra);
  const docs = ownedItems(WARDROBES.orta, u.id, prefix);
  await t.models.ItemModel.insertMany(docs);
  return { ...u, docs };
}

const ISTANBUL = { type: 'coords', lat: 41.01, lon: 28.97, label: 'İstanbul' };

test('kombin isteği: konumun havası kullanılır, son konum kaydedilir; kural embedding\'i istek sırasında hesaplanmaz', async () => {
  const u = await userWithWardrobe('Kombin');
  await useWeather(-2, 73);
  let embedCalls = 0;
  (await gemini()).setAiClientForTests({ generateContent: unavailableAi.generateContent, embedContent: async () => { embedCalls++; throw new Error('yok'); } });

  const res = await t.api('POST', '/api/generate-outfit', { token: u.token, body: { request: { event: 'Ofis', location: ISTANBUL, personalContext: 'Ofiste çalışıyorum, klasik giyinirim.' } } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.weather.feelsLikeC, -2);
  assert.equal(res.body.usedFallback, true);
  assert.ok(res.body.outfits.length >= 1);
  assert.ok(res.body.outfits[0].items.some((i: any) => i.category === 'outerwear'), 'karda dış giyim');
  // Yalnızca serbest metin sorgusu için 1 deneme; 100+ kural için istek sırasında hesaplama yok
  assert.ok(embedCalls <= 1, `embedding çağrısı: ${embedCalls}`);

  const user: any = await (t.models.UserModel as any).findById(u.id).lean();
  assert.equal(user.lastLocation.label, 'İstanbul');
});

test('günlük öneri: son konumun havasıyla üretilir, aynı gün önbellekten gelir, yenile ile yeniden üretilir', async () => {
  const u = await userWithWardrobe('Gunluk', { lastLocation: { latitude: 39.9, longitude: 32.8, label: 'Ankara', updatedAt: new Date() } });
  await useWeather(30, 0);
  const first = await t.api('GET', '/api/daily-pick', { token: u.token });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.cached, false);
  assert.equal(first.body.date, localDate());
  assert.equal(first.body.result.weather.locationLabel, 'Ankara');
  assert.ok(first.body.result.outfits[0].items.every((i: any) => i.category !== 'outerwear'), 'sıcakta dış giyim yok');

  const second = await t.api('GET', '/api/daily-pick', { token: u.token });
  assert.equal(second.body.cached, true);
  assert.equal(second.body.result.generationId, first.body.result.generationId);
  const refreshed = await t.api('GET', '/api/daily-pick?refresh=1', { token: u.token });
  assert.equal(refreshed.body.cached, false);
  assert.notEqual(refreshed.body.result.generationId, first.body.result.generationId);
});

test('seyahat planı: her gün bir kombin, tekrar kullanılan parçalarla tek bavul listesi', async () => {
  const u = await userWithWardrobe('Seyahat');
  await useWeather(12, 61, 80);
  const start = addDays(localDate(), 2);
  const end = addDays(start, 3);

  const res = await t.api('POST', '/api/trips/plan', { token: u.token, body: { location: ISTANBUL, startDate: start, endDate: end } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.days.length, 4);
  assert.deepEqual(res.body.days.map((d: any) => d.date), [start, addDays(start, 1), addDays(start, 2), end]);
  assert.ok(res.body.days.every((d: any) => d.outfit && d.weather?.precipitationProbability === 80));

  const packed = res.body.packingList.flatMap((g: any) => g.items.map((i: any) => i.id));
  const used = new Set(res.body.days.flatMap((d: any) => d.outfit.itemIds));
  assert.equal(packed.length, used.size, 'bavulda her parça bir kez');
  const totalSlots = res.body.days.reduce((s: number, d: any) => s + d.outfit.itemIds.length, 0);
  assert.ok(used.size < totalSlots, 'parçalar günler arasında tekrar kullanılmalı');
  assert.ok(res.body.tips.some((tip: string) => tip.includes('şemsiye')));
  const tops = res.body.days.map((d: any) => d.outfit.items.find((i: any) => i.category === 'top' || i.category === 'onepiece')?.id);
  assert.ok(tops.every((id: string, i: number) => i === 0 || id !== tops[i - 1]), 'ardışık günlerde aynı üst parça yok');

  for (const body of [
    { location: ISTANBUL, startDate: addDays(localDate(), -1), endDate: end },
    { location: ISTANBUL, startDate: end, endDate: start },
    { location: ISTANBUL, startDate: start, endDate: addDays(start, 20) },
    { startDate: start, endDate: end },
  ]) {
    assert.equal((await t.api('POST', '/api/trips/plan', { token: u.token, body })).status, 400, JSON.stringify(body));
  }
});

test('beraber kombin: arkadaşın kombini de aynı havaya göre kurulur, arkadaşın kişisel verisi kullanılmaz', async () => {
  const me = await userWithWardrobe('Baslatan');
  const friend = await userWithWardrobe('Arkadas', GRANTED(['personalization']), 'f_');
  // Arkadaşın tercih profili kombin seçimini etkilememeli: tüm parçalarını "sevmiyor" gibi görünse de sonuç üretilir
  await t.models.PreferenceProfileModel.create({ userId: friend.id, affinities: { item: {}, colorFamily: { lacivert: -20 }, style: {}, fit: {}, pattern: {} } });
  const calls = await useWeather(-3, 71);

  const res = await t.api('POST', '/api/collab/generate', { token: me.token, body: { friendUserId: friend.id, event: 'Gündelik', location: ISTANBUL } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.weather.feelsLikeC, -3);
  const friendOuter = res.body.friendItems.find((i: any) => i.category === 'outerwear');
  assert.ok(friendOuter && friendOuter.warmth >= 4, `arkadaşın dış giyimi: ${JSON.stringify(friendOuter)}`);
  assert.ok(res.body.friendItems.every((i: any) => i.id.startsWith('f_')), 'arkadaşın parçaları kendi gardırobundan');
  assert.ok(res.body.myItems.every((i: any) => !i.id.startsWith('f_')));
  assert.ok(!('embedding' in res.body.friendItems[0]));
  assert.equal(calls.filter(u => u.includes('forecast')).length, 1, 'hava bir kez alınır');
  const friendUser: any = await (t.models.UserModel as any).findById(friend.id).lean();
  assert.ok(!friendUser.lastLocation?.latitude, 'arkadaşın konumu güncellenmez');

  assert.equal((await t.api('POST', '/api/collab/generate', { token: me.token, body: { friendUserId: me.id } })).status, 400);
  assert.equal((await t.api('POST', '/api/collab/generate', { token: me.token, body: { friendUserId: { $ne: null } } })).status, 400);
});

test('web push: rıza olmadan abone olunamaz, geçersiz abonelik reddedilir', async () => {
  process.env.VAPID_PUBLIC_KEY = 'BPublicKeyForTests';
  process.env.VAPID_PRIVATE_KEY = 'privateKeyForTests';
  try {
    const noConsent = await t.createUser('Bildirimsiz');
    const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' } };
    assert.equal((await t.api('POST', '/api/push/subscribe', { token: noConsent.token, body: sub })).status, 403);

    const u = await t.createUser('Bildirimli', GRANTED(['push']));
    assert.deepEqual((await t.api('GET', '/api/push/public-key', { token: u.token })).body, { enabled: true, publicKey: 'BPublicKeyForTests' });
    assert.equal((await t.api('POST', '/api/push/subscribe', { token: u.token, body: { ...sub, endpoint: 'http://insecure.example/x' } })).status, 400);
    assert.equal((await t.api('POST', '/api/push/subscribe', { token: u.token, body: { ...sub, keys: { p256dh: '<script>', auth: 'x' } } })).status, 400);
    assert.equal((await t.api('POST', '/api/push/subscribe', { token: u.token, body: sub })).status, 200);
    assert.equal((await t.api('POST', '/api/push/subscribe', { token: u.token, body: sub })).status, 200);
    assert.equal(await t.models.PushSubscriptionModel.countDocuments({ userId: u.id } as any), 1);
    assert.equal((await t.api('DELETE', '/api/push/subscribe', { token: u.token, body: { endpoint: sub.endpoint } })).status, 200);
    assert.equal(await t.models.PushSubscriptionModel.countDocuments({ userId: u.id } as any), 0);
  } finally {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
  }
  const u2 = await t.createUser('Kapali', GRANTED(['push']));
  assert.equal((await t.api('GET', '/api/push/public-key', { token: u2.token })).body.enabled, false);
});

test('zamanlanmış görev: anahtarsız çağrı reddedilir; rızalı kullanıcıya günde bir bildirim, süresi dolan abonelik silinir', async () => {
  assert.equal((await t.api('GET', '/api/cron/daily')).status, 401);
  process.env.CRON_SECRET = 'cron-secret-for-tests-123';
  try {
    assert.equal((await t.api('GET', '/api/cron/daily', { headers: { Authorization: 'Bearer yanlis' } })).status, 401);

    const u = await userWithWardrobe('Sabah', { ...GRANTED(['push']), lastLocation: { latitude: 41, longitude: 29, label: 'İstanbul' } }, 's_');
    const withdrawn = await userWithWardrobe('Vazgecen', {}, 'v_');
    const { PushSubscriptionModel } = t.models;
    await PushSubscriptionModel.create({ userId: u.id, endpoint: 'https://push.example/ok', keys: { p256dh: 'a', auth: 'b' } });
    await PushSubscriptionModel.create({ userId: u.id, endpoint: 'https://push.example/expired', keys: { p256dh: 'a', auth: 'b' } });
    await PushSubscriptionModel.create({ userId: withdrawn.id, endpoint: 'https://push.example/norconsent', keys: { p256dh: 'a', auth: 'b' } });
    await useWeather(18, 2);

    const sent: { endpoint: string; payload: any }[] = [];
    (await push()).setPushSenderForTests(async (sub, payload) => {
      if (sub.endpoint.endsWith('expired')) throw Object.assign(new Error('Gone'), { statusCode: 410 });
      sent.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) });
    });
    let aiCalls = 0;
    (await gemini()).setAiClientForTests({ generateContent: async () => { aiCalls++; throw new Error('x'); }, embedContent: async () => { aiCalls++; throw new Error('x'); } });

    const headers = { Authorization: 'Bearer cron-secret-for-tests-123' };
    const run = await t.api('GET', '/api/cron/daily', { headers });
    assert.equal(run.status, 200, JSON.stringify(run.body));
    assert.equal(sent.length, 1);
    assert.equal(sent[0].endpoint, 'https://push.example/ok');
    assert.ok(sent[0].payload.title.startsWith('Bugünün kombini'));
    assert.ok(sent[0].payload.body.includes('İstanbul'));
    assert.equal(await PushSubscriptionModel.countDocuments({ endpoint: 'https://push.example/expired' } as any), 0);
    const generateCalls = aiCalls;

    const again = await t.api('GET', '/api/cron/daily', { headers });
    assert.equal(again.status, 200);
    assert.equal(sent.length, 1, 'aynı gün ikinci bildirim gönderilmez');
    assert.ok(generateCalls <= 20, 'günlük bildirim kural motoruyla üretilir');
  } finally {
    delete process.env.CRON_SECRET;
  }
});

test('stil profili doğrulaması', async () => {
  const u = await t.createUser('Profil');
  const ok = await t.api('PUT', '/api/style/profile', { token: u.token, body: { preferredFits: ['oversize'], avoidFits: ['dar'], dislikedColorFamilies: ['turuncu'], notes: ' Rahat kesim ' } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.deepEqual(ok.body.preferredFits, ['oversize']);
  assert.equal(ok.body.notes, 'Rahat kesim');
  assert.equal(ok.body.personalColor, null);
  assert.equal(ok.body.preferenceSummary, null);
  for (const body of [{ preferredFits: ['belirsiz'] }, { dislikedColorFamilies: ['fuşya'] }, { preferredFits: ['dar'], avoidFits: ['dar'] }, { notes: 5 }]) {
    assert.equal((await t.api('PUT', '/api/style/profile', { token: u.token, body })).status, 400, JSON.stringify(body));
  }
});

test('kişisel renk analizi: açık rıza gerekir, fotoğraf saklanmaz, sonuç profile yazılır', async () => {
  const selfie = { base64: Buffer.alloc(300, 7).toString('base64'), mimeType: 'image/jpeg' };
  const noConsent = await t.createUser('Rizasiz');
  assert.equal((await t.api('POST', '/api/style/personal-color', { token: noConsent.token, body: selfie })).status, 403);

  const u = await t.createUser('Renkli');
  // Rıza akışı uç noktadan
  await t.api('PUT', '/api/auth/consents', { token: u.token, body: { personalColor: true, noticeVersion: NOTICE_VERSION } });
  assert.equal((await t.api('POST', '/api/style/personal-color', { token: u.token, body: { ...selfie, mimeType: 'application/pdf' } })).status, 400);

  (await gemini()).setAiClientForTests(scriptedAi(params => (params.config?.responseJsonSchema?.properties?.undertone
    ? { faceVisible: true, season: 'kış', undertone: 'soğuk', contrast: 'yüksek', bestColorFamilies: ['lacivert', 'bordo', 'beyaz', 'fuşya'], avoidColorFamilies: ['turuncu', 'lacivert'], note: 'Net ve soğuk tonlar sana yakışır.' }
    : null)));
  const res = await t.api('POST', '/api/style/personal-color', { token: u.token, body: selfie });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.personalColor.season, 'kış');
  assert.deepEqual(res.body.personalColor.bestColorFamilies, ['lacivert', 'bordo', 'beyaz']);
  assert.deepEqual(res.body.personalColor.avoidColorFamilies, ['turuncu'], 'iki listede olan renk kaçın listesinden çıkar');
  const stored: any = await (t.models.UserModel as any).findById(u.id).lean();
  assert.ok(!JSON.stringify(stored).includes(selfie.base64), 'fotoğraf veritabanına yazılmamalı');

  (await gemini()).setAiClientForTests(scriptedAi(() => ({ faceVisible: false, season: 'yaz', undertone: 'nötr', contrast: 'orta', bestColorFamilies: ['gri', 'beyaz', 'siyah'], avoidColorFamilies: [], note: '' })));
  const noFace = await t.api('POST', '/api/style/personal-color', { token: u.token, body: selfie });
  assert.equal(noFace.status, 400);
  assert.ok(noFace.body.error.includes('yüz'));

  const removed = await t.api('DELETE', '/api/style/personal-color', { token: u.token });
  assert.equal(removed.body.personalColor, null);
});
