import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WARDROBES, SCENARIOS, weather } from '../scripts/eval/fixtures.js';
import { runLocal } from '../scripts/eval/runLocal.js';
import { validateOutfit } from '../backend/engine/validator.js';
import { toEngineItem } from '../backend/engine/items.js';
import { colorScore, scoreOutfit } from '../backend/engine/scoring.js';
import { buildContext } from '../backend/engine/context.js';
import { selectCandidates, DEFAULT_K } from '../backend/engine/candidates.js';
import { NEUTRAL_COLOR_FAMILIES } from '../shared/wardrobe.js';

const scenario = (id: string) => SCENARIOS.find(s => s.id === id)!;

test('tüm gardırop × senaryo kombinlerinde doğrulama ihlali yok', () => {
  for (const [name, docs] of Object.entries(WARDROBES)) {
    for (const sc of SCENARIOS) {
      const run = runLocal(docs, sc);
      assert.ok(run.outfits.length > 0, `${name}/${sc.id}: kombin yok (${run.warnings.join(' | ')})`);
      for (const outfit of run.outfits) {
        const violations = validateOutfit(outfit.itemIds, run.byId, { ctx: run.ctx, ownsOuterwear: run.ownsOuterwear });
        assert.deepEqual(violations, [], `${name}/${sc.id}: ${violations.map(v => v.message).join('; ')}`);
      }
    }
  }
});

test('çok sıcakta dış giyim yok, dondurucu soğukta kalın dış giyim var', () => {
  const hot = runLocal(WARDROBES.orta, scenario('gundelik_sicak'));
  assert.ok(hot.outfits.every(o => !o.items.some(i => i.category === 'outerwear')));
  const freezing = runLocal(WARDROBES.orta, scenario('gorusme_kar'));
  for (const outfit of freezing.outfits.slice(0, 3)) {
    const outer = outfit.items.find(i => i.category === 'outerwear');
    assert.ok(outer && outer.warmth >= 4, `dış giyim: ${outer?.name}`);
    const shoes = outfit.items.find(i => i.category === 'shoes')!;
    assert.ok(shoes.warmth >= 2, `ayakkabı: ${shoes.name}`);
  }
});

test('yağışta ilk kombinin dış giyimi su geçirmez', () => {
  const run = runLocal(WARDROBES.orta, scenario('ofis_yagmur'));
  const outer = run.outfits[0].items.find(i => i.category === 'outerwear');
  assert.ok(outer?.waterResistant, `dış giyim: ${outer?.name}`);
});

test('spor etkinliğinde resmi parça seçilmez; düğünde ortalama resmiyet yüksek', () => {
  const sport = runLocal(WARDROBES.buyuk, scenario('spor_soguk_ofis_kimligi'));
  for (const outfit of sport.outfits.slice(0, 3)) {
    assert.ok(outfit.items.filter(i => i.category !== 'outerwear').every(i => i.formality <= 3), outfit.items.map(i => i.name).join(', '));
  }
  const wedding = runLocal(WARDROBES.buyuk, scenario('dugun_gunduz'));
  const main = wedding.outfits[0].items.filter(i => i.category !== 'accessory');
  const avg = main.reduce((s, i) => s + i.formality, 0) / main.length;
  assert.ok(avg >= 3.5, `ortalama resmiyet ${avg}`);
});

test('Nötr Tonlar/Monokromatik isteğinde ilk kombin vurgu rengi içermez', () => {
  const run = runLocal(WARDROBES.orta, scenario('minimal_kapali_mekan'));
  const accents = run.outfits[0].items.filter(i => ['top', 'bottom', 'onepiece', 'outerwear'].includes(i.category) && i.colorFamily && !NEUTRAL_COLOR_FAMILIES.includes(i.colorFamily));
  assert.equal(accents.length, 0, run.outfits[0].items.map(i => i.name).join(', '));
});

test('zorunlu parça her kombinde bulunur, hariç tutulan hiçbirinde bulunmaz', () => {
  const docs = WARDROBES.orta;
  const bot = docs.find(d => d.subCategory === 'deri bot')!;
  const kaban = docs.find(d => d.subCategory === 'yün kaban')!;
  const run = runLocal(docs, scenario('okul_soguk'), { required: [bot.id], excluded: [kaban.id] });
  assert.ok(run.outfits.length > 0);
  for (const outfit of run.outfits) {
    assert.ok(outfit.itemIds.includes(bot.id));
    assert.ok(!outfit.itemIds.includes(kaban.id));
  }
});

test('aynı girdi aynı sonucu verir; kombinler birbirinden farklıdır', () => {
  const a = runLocal(WARDROBES.buyuk, scenario('parti_serin'));
  const b = runLocal(WARDROBES.buyuk, scenario('parti_serin'));
  assert.deepEqual(a.outfits.map(o => o.id), b.outfits.map(o => o.id));
  assert.equal(new Set(a.outfits.map(o => o.id)).size, a.outfits.length);
  const [first, second] = a.outfits;
  const shared = first.itemIds.filter(id => second.itemIds.includes(id)).length;
  assert.ok(shared < first.itemIds.length, 'ilk iki kombin aynı');
});

test('aday havuzu kategori başına K sınırını aşmaz ve büyük gardıropta hızlıdır', () => {
  const sc = scenario('seyahat_saganak');
  const items = WARDROBES.buyuk.map(toEngineItem);
  const ctx = buildContext({ event: sc.request.event, weather: sc.weather, date: new Date(sc.date) });
  const { pool } = selectCandidates(items, ctx, { required: new Set(), excluded: new Set() });
  for (const [category, list] of Object.entries(pool)) {
    assert.ok(list.length <= DEFAULT_K[category as keyof typeof DEFAULT_K], `${category}: ${list.length}`);
  }
  const started = Date.now();
  runLocal(WARDROBES.buyuk, sc);
  assert.ok(Date.now() - started < 3000, `süre ${Date.now() - started}ms`);
});

test('renk puanı: nötr + tek vurgu, çatışan iki vurgudan yüksek', () => {
  const ctx = buildContext({ event: 'Gündelik', weather: null, ignoreWeather: true });
  const item = (id: string, category: string, colorFamily: string) => toEngineItem({ id, name: id, category, subCategory: category, colorFamily, style: 'casual', formality: 2, warmth: 2, pattern: 'düz', fit: 'normal', seasons: ['yaz'] });
  const neutralAccent = [item('a', 'top', 'kırmızı'), item('b', 'bottom', 'lacivert'), item('c', 'shoes', 'beyaz')];
  const clash = [item('a', 'top', 'kırmızı'), item('b', 'bottom', 'yeşil'), item('c', 'shoes', 'beyaz')];
  assert.ok(colorScore(neutralAccent, ctx) > colorScore(clash, ctx));
});

test('eski kayıtlar (yeni alanlar boş) tahminle motor tarafından kullanılabilir', () => {
  const legacy = toEngineItem({ id: 'x', name: 'Kaban', category: 'outerwear', subCategory: 'yün kaban', color: 'Lacivert', style: 'formal', weatherMatch: ['cold', 'snowy'] });
  assert.equal(legacy.colorFamily, 'lacivert');
  assert.equal(legacy.warmth, 5);
  assert.equal(legacy.layerRole, 'outer');
  assert.ok(legacy.formality >= 4);
  const dress = toEngineItem({ id: 'y', name: 'Elbise', category: 'top', subCategory: 'midi elbise', style: 'elegant' });
  assert.equal(dress.category, 'onepiece');
});

test('tekrar cezası yakın zamanda gösterilen kombini geriye iter', () => {
  const sc = scenario('randevu_ilik');
  const first = runLocal(WARDROBES.orta, sc);
  const top = first.outfits[0];
  const again = runLocal(WARDROBES.orta, sc, { deps: { recentOutfits: [top.itemIds] } });
  assert.notEqual(again.outfits[0].id, top.id);
  const rescored = scoreOutfit(top.items, first.ctx, { recentOutfits: [top.itemIds] });
  assert.ok(rescored.variety < top.breakdown.variety);
});
