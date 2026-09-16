import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retrieveRules, retrieveExamples, styleTagsFromText } from '../backend/knowledge/retrieval.js';
import { KNOWLEDGE_RULES } from '../backend/knowledge/rules.js';
import { buildContext } from '../backend/engine/context.js';
import { weather } from '../scripts/eval/fixtures.js';

const ids = (rules: { id: string }[]) => rules.map(r => r.id);
const coldOnly = new Set(KNOWLEDGE_RULES.filter(r => r.tempBands && r.tempBands.every(b => ['cool', 'cold', 'freezing'].includes(b))).map(r => r.id));

test('bilgi tabanı yeterli büyüklükte ve kimlikler benzersiz', () => {
  assert.ok(KNOWLEDGE_RULES.length >= 100, `kural sayısı ${KNOWLEDGE_RULES.length}`);
  assert.equal(new Set(ids(KNOWLEDGE_RULES)).size, KNOWLEDGE_RULES.length);
  for (const rule of KNOWLEDGE_RULES) {
    const constrained = rule.events || rule.tempBands || rule.precipitation || rule.seasons || rule.formality || rule.styleTags || rule.moods || rule.requiresOnepiece;
    assert.ok(constrained || rule.general, `${rule.id} koşulsuz ama general değil`);
  }
});

test('1.4 kabul: Ankara 30°C gündelik → kış kuralı yok, sıcak hava kuralı var', () => {
  const ctx = buildContext({ event: 'Gündelik', weather: weather({ locationLabel: 'Ankara', temperatureC: 30, feelsLikeC: 31, weatherCode: 0, condition: 'Açık' }) });
  const rules = retrieveRules({ ctx, hasOnepiece: false });
  assert.ok(!rules.some(r => coldOnly.has(r.id)), ids(rules).join(','));
  assert.ok(rules.some(r => r.category === 'weather' && r.tempBands?.includes('hot')));
});

test('1.4 kabul: 2°C karlı iş görüşmesi → görüşme ve kış/kar kuralları birlikte gelir', () => {
  const ctx = buildContext({ event: 'İş Görüşmesi', weather: weather({ temperatureC: 2, feelsLikeC: -1, weatherCode: 73, condition: 'Orta şiddetli kar' }) });
  const rules = retrieveRules({ ctx, hasOnepiece: false });
  assert.ok(rules.some(r => r.events?.includes('İş Görüşmesi')), ids(rules).join(','));
  assert.ok(rules.some(r => r.category === 'weather' && (r.precipitation?.includes('snow') || r.tempBands?.includes('freezing'))), ids(rules).join(','));
});

test('1.4 kabul: -3°C karlı spor + "ofiste çalışırım" stil kimliği → spor ve soğuk kuralları, ofis kuralı yok', () => {
  const ctx = buildContext({
    event: 'Spor',
    personalContext: 'Ofiste çalışıyorum, genelde rahat ve şık giyinirim.',
    weather: weather({ temperatureC: -3, feelsLikeC: -7, weatherCode: 71, condition: 'Hafif kar' }),
  });
  const rules = retrieveRules({ ctx, hasOnepiece: false });
  assert.ok(rules.some(r => r.events?.includes('Spor')), ids(rules).join(','));
  assert.ok(rules.some(r => r.category === 'weather'), ids(rules).join(','));
  assert.ok(!rules.some(r => r.events && !r.events.includes('Spor')), ids(rules).join(','));
});

test('1.4 kabul: randevu etkinliği randevu kurallarını getirir', () => {
  const ctx = buildContext({ event: 'Randevu', weather: weather({ temperatureC: 18, feelsLikeC: 18, weatherCode: 2 }) });
  const rules = retrieveRules({ ctx, hasOnepiece: false });
  assert.ok(rules.some(r => r.events?.includes('Randevu')), ids(rules).join(','));
});

test('düğün kurallarında jean önerisi yok; beyazdan kaçınma kuralı var', () => {
  const ctx = buildContext({ event: 'Düğün/Davet', dressiness: 5, weather: weather({ temperatureC: 24, feelsLikeC: 24, weatherCode: 0 }) });
  const rules = retrieveRules({ ctx, hasOnepiece: false });
  assert.ok(rules.some(r => r.id === 'occ_wedding_white' || r.id === 'occ_wedding_formula'), ids(rules).join(','));
  assert.ok(!rules.some(r => /jean.*cesur/i.test(r.text)));
});

test('stil etiketleri ve Türkçe büyük İ harfi doğru eşleşir', () => {
  assert.deepEqual(styleTagsFromText('Genelde MİNİMALİST ve klasik giyinirim'), ['Minimalist', 'Klasik']);
  const ctx = buildContext({ event: 'Gündelik', styleTags: ['Monokromatik'], ignoreWeather: true, weather: null });
  const rules = retrieveRules({ ctx, hasOnepiece: false });
  assert.ok(rules.some(r => r.id === 'color_tonal'), ids(rules).join(','));
  assert.ok(!rules.some(r => r.category === 'weather'));
});

test('kural sayısı ve kategori kotaları aşılmaz; tek parça kuralı yalnızca tek parça varsa gelir', () => {
  const ctx = buildContext({ event: 'Parti', mood: 'Romantik', styleTags: ['Romantic', 'Maximalist'], weather: weather({ temperatureC: 5, feelsLikeC: 2, weatherCode: 61 }) });
  const without = retrieveRules({ ctx, hasOnepiece: false });
  const withPiece = retrieveRules({ ctx, hasOnepiece: true });
  assert.ok(without.length <= 9 && withPiece.length <= 9);
  assert.ok(!without.some(r => r.category === 'onepiece'));
  assert.ok(withPiece.some(r => r.category === 'onepiece'));
  const occasion = without.filter(r => r.category === 'occasion').length;
  assert.ok(occasion <= 2);
});

test('örnek kombinler bağlama göre seçilir', () => {
  const ctx = buildContext({ event: 'Ofis', weather: weather({ temperatureC: 11, feelsLikeC: 9, weatherCode: 61, precipitationProbability: 80 }) });
  const examples = retrieveExamples(ctx);
  assert.ok(examples.length > 0);
  assert.ok(examples.every(e => e.events.includes('Ofis')));
});
