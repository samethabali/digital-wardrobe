import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, TestContext, GRANTED, ownedItems } from './helpers/testServer.js';
import { WARDROBES } from '../scripts/eval/fixtures.js';
import { addDays, localDate } from '../backend/time.js';

let t: TestContext;
before(async () => { t = await startTestServer(); });
after(async () => { await t.stop(); });

async function userWithItems(name: string, consent: boolean, prefix = '') {
  const u = await t.createUser(name, consent ? GRANTED(['personalization']) : {});
  const docs = ownedItems(WARDROBES.orta, u.id, prefix);
  await t.models.ItemModel.insertMany(docs);
  const byColor = (category: string, color: string) => docs.find(d => d.category === category && d.colorFamily === color)!;
  return { ...u, docs, byColor };
}

test('geri bildirim doğrulaması: tür, parça listesi, neden ve değiştirilen parça', async () => {
  const { token } = await t.createUser('Dogrulama');
  const cases: [unknown, string][] = [
    [{ type: 'shown', itemIds: ['a'] }, 'shown istemciden kabul edilmez'],
    [{ type: 'hacked', itemIds: ['a'] }, 'bilinmeyen tür'],
    [{ type: 'worn', itemIds: 'a' }, 'liste olmayan itemIds'],
    [{ type: 'worn', itemIds: [] }, 'boş parça listesi'],
    [{ type: 'worn', itemIds: [{ $gt: '' }] }, 'nesne enjeksiyonu'],
    [{ type: 'worn', itemIds: Array.from({ length: 13 }, (_, i) => `i${i}`) }, 'çok uzun liste'],
    [{ type: 'disliked', itemIds: ['a'], reason: 'nedensiz' }, 'bilinmeyen neden'],
    [{ type: 'replaced', itemIds: ['a'] }, 'değiştirilen parça yok'],
    [{ type: 'saved', itemIds: ['a'], generationId: '../../etc' }, 'geçersiz öneri kimliği'],
  ];
  for (const [body, label] of cases) {
    const res = await t.api('POST', '/api/feedback', { token, body });
    assert.equal(res.status, 400, label);
  }
});

test('rıza yoksa geri bildirim saklanmaz ama "giydim" giyim günlüğüne Türkiye tarihiyle yazılır', async () => {
  const u = await userWithItems('Rizasiz', false);
  const outfit = [u.docs[0].id, u.docs[20].id];
  const res = await t.api('POST', '/api/feedback', { token: u.token, body: { type: 'worn', itemIds: outfit, generationId: 'gen-1' } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.stored, false);
  assert.ok(res.body.wearLogId);

  assert.equal(await t.models.FeedbackEventModel.countDocuments({ userId: u.id } as any), 0);
  assert.equal(await t.models.PreferenceProfileModel.countDocuments({ userId: u.id } as any), 0);
  const log: any = await t.models.WearLogModel.findOne({ userId: u.id } as any).lean();
  assert.equal(log.date, localDate());
  assert.equal(log.source, 'suggestion');
  const item: any = await t.models.ItemModel.findOne({ userId: u.id, id: outfit[0] } as any).lean();
  assert.equal(item.wearCount, 1);
  assert.ok(item.lastWornAt);

  const disliked = await t.api('POST', '/api/feedback', { token: u.token, body: { type: 'disliked', itemIds: outfit, reason: 'renk' } });
  assert.equal(disliked.body.stored, false);
  assert.equal(await t.models.FeedbackEventModel.countDocuments({ userId: u.id } as any), 0);
});

test('aynı gün aynı kombin iki kez "giydim" denirse sayaç iki kez artmaz', async () => {
  const u = await userWithItems('Cift', false);
  const body = { type: 'worn', itemIds: [u.docs[1].id, u.docs[21].id] };
  const first = await t.api('POST', '/api/feedback', { token: u.token, body });
  const second = await t.api('POST', '/api/feedback', { token: u.token, body: { ...body, itemIds: [...body.itemIds].reverse() } });
  assert.equal(first.body.wearLogId, second.body.wearLogId);
  assert.equal(await t.models.WearLogModel.countDocuments({ userId: u.id } as any), 1);
  const item: any = await t.models.ItemModel.findOne({ userId: u.id, id: u.docs[1].id } as any).lean();
  assert.equal(item.wearCount, 1);
});

test('rıza varsa olay saklanır ve tercih profili güncellenir; başkasının parçaları yok sayılır', async () => {
  const u = await userWithItems('Rizali', true);
  const stranger = await userWithItems('Yabanci', false, 'y_');
  const red = u.byColor('top', 'kırmızı') || u.docs.find(d => d.colorFamily === 'kırmızı')!;
  const outfit = [red.id, u.docs.find(d => d.category === 'bottom')!.id, stranger.docs[0].id];

  const res = await t.api('POST', '/api/feedback', {
    token: u.token,
    body: { type: 'disliked', itemIds: outfit, reason: 'renk', context: { event: 'Gündelik', formalityMin: 1, formalityMax: 3, formalityTarget: 2, activity: 2, tempBand: 'mild', precipitation: 'none', outerwear: 'optional', needsWaterResistant: false, season: 'sonbahar', injected: '$where' } },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.stored, true);
  assert.equal(res.body.wearLogId, null);

  const event: any = await t.models.FeedbackEventModel.findOne({ userId: u.id } as any).lean();
  assert.equal(event.type, 'disliked');
  assert.deepEqual(event.itemIds, outfit.slice(0, 2));
  assert.equal(event.context.tempBand, 'mild');
  assert.ok(!('injected' in event.context));

  const profile: any = await t.models.PreferenceProfileModel.findOne({ userId: u.id } as any).lean();
  assert.ok(profile.affinities.colorFamily['kırmızı'] < 0, JSON.stringify(profile.affinities.colorFamily));
  assert.ok(!(stranger.docs[0].id in profile.affinities.item));
  assert.equal(profile.eventCount, 1);
});

test('öneriden kaydedilen kombin "saved" olayı üretir; elle oluşturulan üretmez', async () => {
  const u = await userWithItems('Kaydeden', true);
  const items = [u.docs[2].id, u.docs[22].id];
  const saved = await t.api('POST', '/api/outfits', { token: u.token, body: { name: 'AI', items, stylingReason: 'x', compatibilityScore: 88, generationId: 'gen-9', source: 'ai' } });
  assert.equal(saved.status, 200);
  const manual = await t.api('POST', '/api/outfits', { token: u.token, body: { name: 'Elle', items, source: 'manual' } });
  assert.equal(manual.status, 200);
  const events: any[] = await t.models.FeedbackEventModel.find({ userId: u.id } as any).lean();
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'saved');
  assert.equal(events[0].generationId, 'gen-9');

  assert.equal((await t.api('POST', '/api/outfits', { token: u.token, body: { name: 'Boş', items: [] } })).status, 400);
  assert.equal((await t.api('POST', '/api/outfits', { token: u.token, body: { name: 'Yabancı', items: ['yok_1'] } })).status, 400);
  assert.equal((await t.api('POST', '/api/outfits', { token: u.token, body: { items, compatibilityScore: 900 } })).status, 400);
});

test('giyim günlüğü: elle kayıt, tarih doğrulaması, listeleme ve silmede sayaç düzeltmesi', async () => {
  const u = await userWithItems('Gunluk', false);
  const today = localDate();
  const ids = [u.docs[3].id, u.docs[23].id];

  assert.equal((await t.api('POST', '/api/wear-log', { token: u.token, body: { date: addDays(today, 1), itemIds: ids } })).status, 400);
  assert.equal((await t.api('POST', '/api/wear-log', { token: u.token, body: { date: addDays(today, -400), itemIds: ids } })).status, 400);
  assert.equal((await t.api('POST', '/api/wear-log', { token: u.token, body: { date: '16.09.2026', itemIds: ids } })).status, 400);
  assert.equal((await t.api('POST', '/api/wear-log', { token: u.token, body: { itemIds: ['baskasinin'] } })).status, 404);

  const older = await t.api('POST', '/api/wear-log', { token: u.token, body: { date: addDays(today, -5), itemIds: ids, note: 'toplantı' } });
  assert.equal(older.status, 200, JSON.stringify(older.body));
  const recent = await t.api('POST', '/api/wear-log', { token: u.token, body: { date: addDays(today, -1), itemIds: [ids[0]] } });
  assert.equal(recent.status, 200);

  let item: any = await t.models.ItemModel.findOne({ userId: u.id, id: ids[0] } as any).lean();
  assert.equal(item.wearCount, 2);
  assert.equal(new Date(item.lastWornAt).toISOString().slice(0, 10), addDays(today, -1));

  const list = await t.api('GET', `/api/wear-log?from=${addDays(today, -7)}&to=${today}`, { token: u.token });
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.entries.map((e: any) => e.date), [addDays(today, -1), addDays(today, -5)]);
  assert.equal((await t.api('GET', `/api/wear-log?from=${today}&to=${addDays(today, -3)}`, { token: u.token })).status, 400);

  // Başka kullanıcı silemez
  const other = await t.createUser('Diger');
  assert.equal((await t.api('DELETE', `/api/wear-log/${recent.body.entry.id}`, { token: other.token })).status, 404);

  assert.equal((await t.api('DELETE', `/api/wear-log/${recent.body.entry.id}`, { token: u.token })).status, 200);
  item = await t.models.ItemModel.findOne({ userId: u.id, id: ids[0] } as any).lean();
  assert.equal(item.wearCount, 1);
  assert.equal(new Date(item.lastWornAt).toISOString().slice(0, 10), addDays(today, -5));

  await t.api('DELETE', `/api/wear-log/${older.body.entry.id}`, { token: u.token });
  item = await t.models.ItemModel.findOne({ userId: u.id, id: ids[0] } as any).lean();
  assert.equal(item.wearCount, 0);
  assert.ok(!item.lastWornAt);
});

test('istatistikler: en çok/hiç giyilmeyen, giyim başı maliyet ve stil kümeleri', async () => {
  const u = await userWithItems('Istatistik', false);
  const { ItemModel } = t.models;
  const [a, b] = [u.docs[4], u.docs[24]];
  await ItemModel.updateOne({ userId: u.id, id: a.id } as any, { $set: { wearCount: 10, price: 1000, lastWornAt: new Date() } });
  await ItemModel.updateOne({ userId: u.id, id: b.id } as any, { $set: { wearCount: 2, price: 1000, lastWornAt: new Date(Date.now() - 120 * 86_400_000) } });
  const { fakeVector } = await import('./helpers/testServer.js');
  for (const [i, doc] of u.docs.slice(0, 12).entries()) {
    await ItemModel.updateOne({ userId: u.id, id: doc.id } as any, { $set: { embedding: fakeVector(`küme${i % 2}`).map((v, d) => v + (d === i ? 0.01 : 0)) } });
  }

  const res = await t.api('GET', '/api/stats', { token: u.token });
  assert.equal(res.status, 200);
  assert.equal(res.body.totalItems, u.docs.length);
  assert.equal(res.body.mostWorn[0].id, a.id);
  assert.equal(res.body.neverWornCount, u.docs.filter(d => d.category !== 'makeup').length - 2);
  assert.equal(res.body.costPerWear[0].id, b.id, 'en pahalı giyim başı maliyet önce');
  assert.equal(res.body.costPerWear[0].costPerWear, 500);
  assert.equal(res.body.wardrobeValue, 2000);
  assert.ok(res.body.notWornIn90Days.some((s: any) => s.id === b.id));
  assert.equal(res.body.embeddedItems, 12);
  // İki farklı yönde gruplanmış 12 parça: kümeler iki grubu ayırır
  assert.ok(res.body.styleClusters.length >= 2, JSON.stringify(res.body.styleClusters));
  assert.equal(res.body.styleClusters.reduce((s: number, c: any) => s + c.size, 0), 12);
  assert.ok(!JSON.stringify(res.body).includes('"embedding"'), 'embedding istemciye gönderilmemeli');
});
