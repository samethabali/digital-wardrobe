import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WARDROBES, SCENARIOS, weather } from '../scripts/eval/fixtures.js';
import { runLocal } from '../scripts/eval/runLocal.js';
import { compareSummaries, evaluateCase, summarize } from '../scripts/eval/metrics.js';
import { EMPTY_AFFINITIES, updateAffinities } from '../backend/preferences.js';
import { buildContext, contextFromSummary, summarizeContext } from '../backend/engine/context.js';
import { toEngineItem } from '../backend/engine/items.js';
import { outfitId, ScoredOutfit } from '../backend/engine/builder.js';
import { chooseTripOutfits, REPEAT_TOP_PENALTY, sanitizeTripRequest, tripDates } from '../backend/engine/trip.js';
import { buildTrainingSamples, trainReranker, FeedbackRecord } from '../backend/engine/rerankerTraining.js';
import { predict } from '../backend/engine/reranker.js';
import { computeWardrobeStats, sanitizeWearInput } from '../backend/wearLog.js';
import { sanitizeContextSummary, sanitizeFeedback } from '../backend/feedback.js';
import { invalidatesEmbedding, pickItemUpdate, pickNewOutfit, withDerivedWeatherMatch } from '../backend/itemFields.js';
import { parseConsentChange } from '../backend/account.js';
import { normalizePersonalColor, sanitizeSelfie, sanitizeStyleProfile } from '../backend/personalColor.js';
import { sanitizeSubscription } from '../backend/push.js';
import { dailyPushPayload } from '../backend/daily.js';
import { deleteImages, setImageDeleterForTests } from '../backend/cloudinary.js';
import { isAllowedOrigin } from '../backend/app.js';
import { sendError } from '../backend/http.js';
import { AiError } from '../backend/ai/gemini.js';
import { ConfigError, getCronSecret, getJwtSecret, getVapidConfig } from '../backend/config.js';
import { RequestError } from '../backend/engine/request.js';
import { searchTurkishLocations } from '../shared/turkeyLocations.js';
import { CONSENT_DESCRIPTIONS, CONSENT_KEYS, NOTICE_VERSION } from '../shared/privacy.js';
import { addDays, localDate } from '../backend/time.js';

const scenario = (id: string) => SCENARIOS.find(s => s.id === id)!;

// ─── Faz 3.3 kabul testi ───────────────────────────────────────────────────
test('3.3 kabul: bir rengi sürekli reddeden kullanıcıda o rengin öneri oranı düşer', () => {
  const docs = WARDROBES.buyuk;
  const sc = scenario('randevu_ilik');
  const color = 'bordo';
  const share = (outfits: ScoredOutfit[]) =>
    outfits.filter(o => o.items.some(i => ['top', 'bottom', 'onepiece', 'outerwear'].includes(i.category) && i.colorFamily === color)).length / outfits.length;

  const baseline = runLocal(docs, sc, { limit: 10 });
  const items = new Map(baseline.items.map(i => [i.id, i]));
  const withColor = baseline.items.filter(i => i.colorFamily === color && i.category !== 'accessory');
  assert.ok(withColor.length > 0);
  let affinities = EMPTY_AFFINITIES();
  for (let n = 0; n < 5; n++) {
    const outfit = [withColor[n % withColor.length].id, baseline.items.find(i => i.category === 'shoes')!.id];
    affinities = updateAffinities(affinities, { type: 'disliked', itemIds: outfit, reason: 'renk' }, items);
  }
  const prefs = { affinities, preferredFits: [], avoidFits: [], dislikedColorFamilies: [], bestColorFamilies: [], avoidColorFamilies: [] };
  const learned = runLocal(docs, sc, { limit: 10, deps: { prefs, protectedIds: new Set() } });

  const before = share(baseline.outfits);
  const after = share(learned.outfits);
  assert.ok(before > 0, 'başlangıçta renk önerilerde bulunmalı');
  assert.ok(after < before, `oran düşmeli: önce ${before}, sonra ${after}`);
});

test('bağlam özeti kaydedilip yeniden kurulduğunda puanlamayı etkileyen alanlar korunur', () => {
  for (const id of ['gorusme_kar', 'gundelik_sicak', 'ofis_yagmur', 'minimal_kapali_mekan']) {
    const sc = scenario(id);
    const original = buildContext({ event: sc.request.event, ignoreWeather: sc.request.ignoreWeather, weather: sc.weather, date: new Date(sc.date) });
    const rebuilt = contextFromSummary(summarizeContext(original));
    assert.equal(rebuilt.tempBand, original.tempBand, id);
    assert.equal(rebuilt.outerwear, original.outerwear, id);
    assert.equal(rebuilt.precipitation, original.precipitation, id);
    assert.deepEqual(rebuilt.formality, original.formality, id);
    assert.equal(rebuilt.season, original.season, id);
  }
  // Eski kayıt: feelsLikeC yok, yalnızca bant
  const legacy = contextFromSummary({ event: 'Ofis', formalityMin: 3, formalityMax: 4, formalityTarget: 3.5, activity: 2, tempBand: 'cold', precipitation: 'rain', outerwear: 'required', needsWaterResistant: true, season: 'kış' });
  assert.equal(legacy.tempBand, 'cold');
  assert.equal(legacy.needsWaterResistant, true);
  assert.equal(contextFromSummary(null).weather, null);
});

// ─── Seyahat ───────────────────────────────────────────────────────────────
function fakeOutfit(ids: string[], total: number, topId = ids[0]): ScoredOutfit {
  const items = ids.map(id => toEngineItem({ id, name: id, category: id === topId ? 'top' : id.startsWith('b') ? 'bottom' : 'shoes', style: 'casual' }));
  return { id: outfitId(ids), itemIds: ids, items, breakdown: { weather: null, formality: 80, color: 80, style: 80, silhouette: 80, preference: null, variety: 80, learned: null, total } };
}

test('seyahat: bavuldaki parçaları tekrar kullanan kombin tercih edilir, ardışık günde aynı üst ceza alır', () => {
  const day1 = [fakeOutfit(['t1', 'b1', 's1'], 90)];
  // İkinci gün: t1 tekrarı cezalı, t2+b1+s1 bavul avantajlı, t3+b2+s2 biraz daha yüksek puanlı ama yeni parçalar
  const day2 = [fakeOutfit(['t1', 'b1', 's1'], 92), fakeOutfit(['t2', 'b1', 's1'], 88), fakeOutfit(['t3', 'b2', 's2'], 91)];
  const planned = chooseTripOutfits([
    { date: '2026-10-01', weather: null, candidates: day1 },
    { date: '2026-10-02', weather: null, candidates: day2 },
    { date: '2026-10-03', weather: null, candidates: [] },
  ]);
  assert.deepEqual(planned[0].outfit!.itemIds, ['t1', 'b1', 's1']);
  assert.deepEqual(planned[1].outfit!.itemIds, ['t2', 'b1', 's1']);
  assert.equal(planned[2].outfit, null);
  assert.ok(REPEAT_TOP_PENALTY > 0);
  assert.deepEqual(tripDates('2026-12-30', '2027-01-02'), ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  const today = localDate();
  assert.equal(sanitizeTripRequest({ location: 'İzmir', startDate: today, endDate: today, event: 'Hack' }, today).event, 'Seyahat');
  assert.throws(() => sanitizeTripRequest({ location: 'İzmir', startDate: today, endDate: addDays(today, 14) }, today), RequestError);
});

// ─── Yeniden sıralayıcı eğitimi ────────────────────────────────────────────
test('eğitim örnekleri: pozitif/negatif etiketler, "Yenile" ile geçilen öneriler ve silinmiş parçalar', () => {
  const items = new Map(WARDROBES.orta.map(d => [d.id, toEngineItem(d)]));
  const ids = WARDROBES.orta.map(d => d.id);
  const ctx = summarizeContext(buildContext({ event: 'Ofis', weather: weather({ feelsLikeC: 12, temperatureC: 12 }) }));
  const events: FeedbackRecord[] = [
    { userId: 'u1', type: 'shown', generationId: 'g1', itemIds: [ids[0], ids[20]], context: ctx, createdAt: '2026-09-01T10:00:00Z' },
    { userId: 'u1', type: 'shown', generationId: 'g1', itemIds: [ids[1], ids[21]], context: ctx, createdAt: '2026-09-01T10:00:00Z' },
    { userId: 'u1', type: 'saved', generationId: 'g1', itemIds: [ids[1], ids[21]], context: ctx, createdAt: '2026-09-01T10:01:00Z' },
    { userId: 'u1', type: 'rerolled', generationId: 'g1', itemIds: [], context: ctx, createdAt: '2026-09-01T10:02:00Z' },
    { userId: 'u1', type: 'disliked', itemIds: [ids[2], ids[22]], context: ctx, createdAt: '2026-09-01T11:00:00Z' },
    { userId: 'u1', type: 'shown', generationId: 'g2', itemIds: [ids[3], ids[23]], context: ctx, createdAt: '2026-09-02T10:00:00Z' },
    { userId: 'u1', type: 'worn', itemIds: [ids[4], 'silinmis'], context: ctx, createdAt: '2026-09-02T10:00:00Z' },
    { userId: 'u2', type: 'saved', itemIds: [ids[5], ids[25]], context: ctx, createdAt: '2026-09-02T10:00:00Z' },
  ];
  const samples = buildTrainingSamples(events, new Map([['u1', items]]));
  // shown(g1, kaydedilmemiş) → 0, saved → 1, disliked → 0; g2 yenilenmedi → yok; silinmiş parça → yok; u2 parçaları yok → yok
  assert.deepEqual(samples.map(s => s.label).sort(), [0, 0, 1]);
  assert.ok(samples.every(s => s.features.length === 12 && s.features.every(Number.isFinite)));
});

test('yeniden sıralayıcı: yetersiz veriyle model üretmez, ayrılabilir veride doğrulama başarısı yüksek', () => {
  const small = trainReranker([{ features: [1, 0], label: 1 }, { features: [0, 1], label: 0 }]);
  assert.equal(small.ok, false);

  let seed = 7;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const samples = Array.from({ length: 400 }, (_, i) => {
    const label = (i % 2) as 0 | 1;
    const features = Array.from({ length: 12 }, (_, d) => (d === 1 ? (label ? 0.8 : 0.3) + random() * 0.2 : random()));
    return { features, label };
  });
  const outcome = trainReranker(samples);
  assert.equal(outcome.ok, true, JSON.stringify(outcome));
  const model = (outcome as any).model;
  assert.ok(model.validationAuc > 0.9);
  assert.ok(predict(model, samples[1].features) > predict(model, samples[0].features));
});

// ─── Değerlendirme metrikleri ──────────────────────────────────────────────
test('değerlendirme: ihlal sayılır, kötüye gidiş karşılaştırmada işaretlenir', () => {
  const run = runLocal(WARDROBES.orta, scenario('gorusme_kar'));
  const good = evaluateCase('orta', 'gorusme_kar', run, run.outfits.slice(0, 3), 10);
  assert.equal(good.invalidOutfits, 0);
  // Sıcak havanın kombinini karda önermek: dış giyim eksik ihlali
  const hot = runLocal(WARDROBES.orta, scenario('gundelik_sicak'));
  const bad = evaluateCase('orta', 'gorusme_kar', run, hot.outfits.slice(0, 2), 10);
  assert.ok(bad.invalidOutfits > 0);
  assert.ok(bad.violations.weather_outerwear_missing > 0, JSON.stringify(bad.violations));

  const previous = summarize('deterministic', [good], '2026-01-01');
  const current = summarize('deterministic', [good, bad], '2026-01-02');
  const deltas = compareSummaries(previous, current);
  assert.equal(deltas.find(d => d.metric === 'invalidRate')!.regression, true);
  assert.equal(compareSummaries(previous, previous).some(d => d.regression), false);
});

// ─── Doğrulayıcılar ────────────────────────────────────────────────────────
test('geri bildirim ve bağlam doğrulaması', () => {
  const clean = sanitizeFeedback({ type: 'replaced', itemIds: ['a', 'a', 'b'], itemId: 'a', note: '  çok  ', extra: 1 });
  assert.deepEqual(clean.itemIds, ['a', 'b']);
  assert.equal(clean.note, 'çok');
  assert.equal(sanitizeFeedback({ type: 'rerolled', generationId: 'g-1' }).itemIds.length, 0);
  assert.equal(sanitizeContextSummary({ event: 'Ofis', formalityMin: 9 }), undefined);
  assert.equal(sanitizeContextSummary('metin'), undefined);
  assert.throws(() => sanitizeFeedback(null), RequestError);
});

test('parça alanı beyaz listesi ve yeni kombin gövdesi', () => {
  const ok = pickItemUpdate({ formality: 3, pattern: '', fit: 'oversize', secondaryColors: ['mavi', 'mavi'], id: 'x', userId: 'y' });
  assert.ok('update' in ok);
  assert.deepEqual((ok as any).update, { formality: 3, pattern: '', fit: 'oversize', secondaryColors: ['mavi'] });
  assert.ok('error' in pickItemUpdate({ weatherMatch: ['tropik'] }));
  assert.ok('error' in pickItemUpdate({ formality: 2.5 }));
  assert.equal(invalidatesEmbedding({ name: 'yeni ad' }), false);
  assert.equal(invalidatesEmbedding({ colorFamily: 'mavi' }), true);
  assert.deepEqual(withDerivedWeatherMatch({ category: 'outerwear' }, { name: 'x' }), { name: 'x' });
  assert.ok((withDerivedWeatherMatch({ category: 'outerwear', warmth: 2 }, { warmth: 5 }).weatherMatch as string[]).includes('cold'));
  const outfit = pickNewOutfit({ items: ['a'], source: 'hack' });
  assert.ok('outfit' in outfit && outfit.outfit.source === 'ai');
});

test('giyim kaydı gövdesi: varsayılan tarih bugün, ileri tarih ve geçersiz liste reddedilir', () => {
  const today = '2026-09-16';
  assert.equal(sanitizeWearInput({ itemIds: ['a'] }, today).date, today);
  assert.equal(sanitizeWearInput({ itemIds: ['a'], source: 'suggestion' }, today).source, 'manual', 'istemci kaynağı yalnızca manual/saved olabilir');
  assert.throws(() => sanitizeWearInput({ date: '2026-09-17', itemIds: ['a'] }, today), RequestError);
  assert.throws(() => sanitizeWearInput({ itemIds: [] }, today), RequestError);
});

test('istatistik hesabı: giyilmeyen, en az giyilen ve 90 gündür giyilmeyenler', () => {
  const items = [
    { id: 'a', name: 'A', category: 'top', wearCount: 5, lastWornAt: '2026-09-10T12:00:00Z', price: 100 },
    { id: 'b', name: 'B', category: 'top', wearCount: 1, lastWornAt: '2026-05-01T12:00:00Z', price: 900 },
    { id: 'c', name: 'C', category: 'shoes', wearCount: 0 },
    { id: 'd', name: 'D', category: 'makeup', wearCount: 0 },
  ];
  const stats = computeWardrobeStats(items, [{ date: '2026-09-10', itemIds: ['a'] }, { date: '2026-05-01', itemIds: ['b'] }], '2026-09-16');
  assert.equal(stats.totalItems, 4);
  assert.equal(stats.totalWears, 6);
  assert.equal(stats.wearsLast30Days, 1);
  assert.deepEqual(stats.mostWorn.map(s => s.id), ['a', 'b']);
  assert.deepEqual(stats.leastWorn.map(s => s.id), ['b', 'a']);
  assert.deepEqual(stats.neverWorn.map(s => s.id), ['c'], 'makyaj giyilme istatistiğine girmez');
  assert.deepEqual(stats.notWornIn90Days.map(s => s.id), ['b']);
  assert.equal(stats.costPerWear[0].costPerWear, 900);
  assert.deepEqual(stats.styleClusters, []);
});

test('rıza gövdesi, stil profili, kişisel renk ve push aboneliği doğrulaması', () => {
  assert.throws(() => parseConsentChange({ personalization: true }), (e: any) => e.status === 409);
  assert.deepEqual(parseConsentChange({ push: false }).changes, { push: false });
  assert.deepEqual(CONSENT_DESCRIPTIONS.map(c => c.key), [...CONSENT_KEYS]);
  assert.match(NOTICE_VERSION, /^\d{4}-\d{2}-\d{2}$/);

  assert.deepEqual(sanitizeStyleProfile({ avoidFits: ['bol', 'bol'] }), { avoidFits: ['bol'] });
  assert.throws(() => sanitizeSelfie({ base64: 'kısa', mimeType: 'image/png' }), RequestError);
  assert.equal(sanitizeSelfie({ base64: `data:image/png;base64,${'A'.repeat(200)}`, mimeType: 'image/png' }).base64.length, 200);
  const pc = normalizePersonalColor({ season: 'muson', undertone: 'mor', bestColorFamilies: ['gri', 'x'], avoidColorFamilies: 'gri' });
  assert.deepEqual([pc.season, pc.undertone, pc.contrast], ['sonbahar', 'nötr', 'orta']);
  assert.deepEqual(pc.bestColorFamilies, ['gri']);
  assert.deepEqual(pc.avoidColorFamilies, []);

  assert.throws(() => sanitizeSubscription({ endpoint: 'javascript:alert(1)', keys: { p256dh: 'a', auth: 'b' } }), RequestError);
  assert.throws(() => sanitizeSubscription({ endpoint: 'https://push.example/x' }), RequestError);
});

test('günlük bildirim metni hava durumunu ve parçaları özetler', () => {
  const payload = dailyPushPayload({
    date: '2026-09-16',
    cached: false,
    result: {
      outfits: [{ title: 'Nötr ofis', items: [{ name: 'Gömlek' }, { name: 'Pantolon' }, { name: 'Loafer' }, { name: 'Kemer' }] }],
      weather: weather({ locationLabel: 'İzmir', temperatureC: 24.4, condition: 'Açık' }),
    } as any,
  });
  assert.equal(payload.title, 'Bugünün kombini: Nötr ofis');
  assert.equal(payload.body, 'İzmir 24°C, açık · Gömlek + Pantolon + Loafer');
  assert.equal(payload.tag, 'daily-2026-09-16');
});

test('görseller 100\'lük gruplarla silinir; başarısız grup raporlanır, diğerleri silinir', async () => {
  const calls: string[][] = [];
  setImageDeleterForTests(async ids => { calls.push(ids); if (calls.length === 2) throw new Error('hata'); });
  const ids = Array.from({ length: 250 }, (_, i) => `p${i}`);
  const result = await deleteImages([...ids, 'p0', '']);
  setImageDeleterForTests(null);
  assert.deepEqual(calls.map(c => c.length), [100, 100, 50]);
  assert.equal(result.deleted, 150);
  assert.equal(result.failed.length, 100);
});

test('yapılandırma: kısa anahtarlar reddedilir, eksik değerlerde özellik kapanır', () => {
  const saved = { ...process.env };
  try {
    process.env.JWT_SECRET = 'a'.repeat(31);
    assert.throws(() => getJwtSecret(), ConfigError);
    process.env.JWT_SECRET = ` ${'a'.repeat(32)} `;
    assert.equal(getJwtSecret(), 'a'.repeat(32));
    delete process.env.VAPID_PUBLIC_KEY;
    assert.equal(getVapidConfig(), null);
    process.env.CRON_SECRET = 'kısa';
    assert.equal(getCronSecret(), null);
  } finally {
    process.env = saved;
  }
});

test('CORS izinleri ve hata eşleme', () => {
  assert.equal(isAllowedOrigin(undefined), true);
  assert.equal(isAllowedOrigin('http://localhost:5173'), true);
  assert.equal(isAllowedOrigin('https://aura-git-main.vercel.app'), true);
  assert.equal(isAllowedOrigin('https://evil.example'), false);

  const captured: { status?: number; body?: any } = {};
  const res: any = { status(code: number) { captured.status = code; return this; }, json(body: any) { captured.body = body; return this; } };
  const quiet = console.error;
  console.error = () => undefined;
  try {
    sendError(res, new RequestError('Eksik alan'), 'x', 'Test');
    assert.deepEqual(captured, { status: 400, body: { error: 'Eksik alan' } });
    sendError(res, new AiError('timeout', 'Zaman aşımı'), 'x', 'Test');
    assert.equal(captured.status, 504);
    sendError(res, new Error('mongo iç ayrıntı: şifre'), 'Genel hata', 'Test');
    assert.deepEqual(captured, { status: 500, body: { error: 'Genel hata' } }, 'beklenmeyen hata ayrıntısı sızmamalı');
    sendError(res, new ConfigError('JWT_SECRET'), 'x', 'Test');
    assert.equal(captured.status, 503);
  } finally {
    console.error = quiet;
  }
});

test('konum araması: yaklaşık koordinatlı ilçeler işaretlenir', () => {
  const [kadikoy] = searchTurkishLocations('Kadıköy', 1);
  assert.equal(kadikoy.approximate, undefined);
  const [kas] = searchTurkishLocations('Kaş, Antalya', 1);
  assert.equal(kas.district, 'Kaş');
  assert.equal(kas.approximate, true);
});
