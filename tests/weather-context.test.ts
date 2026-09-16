import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WMO_CODES, resolveLocation, getWeather, setWeatherFetcherForTests } from '../backend/weather.js';
import { buildContext, tempBandFor } from '../backend/engine/context.js';
import { weather } from '../scripts/eval/fixtures.js';

test('WMO tablosu Open-Meteo kodlarının tamamını içerir (sağanak dahil)', () => {
  const all = [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99];
  for (const code of all) assert.ok(WMO_CODES[code], `kod ${code} eksik`);
});

test('il/ilçe konumu Open-Meteo\'ya "İlçe, İl" sırası ve countryCode=TR ile gönderilir', async () => {
  const calls: string[] = [];
  setWeatherFetcherForTests(async (url) => {
    calls.push(decodeURIComponent(url));
    const name = new URL(url).searchParams.get('name');
    const results = name === 'Kadıköy, İstanbul'
      ? [{ name: 'Kadıköy', latitude: 40.98, longitude: 29.08, admin1: 'İstanbul' }]
      : [];
    return { ok: true, status: 200, json: async () => ({ results }) };
  });
  const loc = await resolveLocation({ type: 'place', province: 'İstanbul', district: 'Kadıköy' });
  setWeatherFetcherForTests(null);
  assert.equal(loc?.latitude, 40.98);
  assert.ok(calls[0].includes('name=Kadıköy, İstanbul'));
  assert.ok(calls[0].includes('countryCode=TR'));
});

test('eski "İl, İlçe" metni yanlış ildeki aynı adlı yere gitmez', async () => {
  setWeatherFetcherForTests(async (url) => {
    const name = new URL(url).searchParams.get('name');
    const results: any[] = [];
    if (name === 'Kadıköy') results.push({ name: 'Babadağ', latitude: 37.8, longitude: 28.8, admin1: 'Denizli' });
    if (name === 'Kadıköy, İstanbul') results.push({ name: 'Kadıköy', latitude: 40.98, longitude: 29.08, admin1: 'İstanbul' });
    if (name === 'İstanbul') results.push({ name: 'İstanbul', latitude: 41.01, longitude: 28.95, admin1: 'İstanbul' });
    return { ok: true, status: 200, json: async () => ({ results }) };
  });
  const loc = await resolveLocation('İstanbul, Kadıköy');
  setWeatherFetcherForTests(null);
  assert.equal(loc?.latitude, 40.98);
});

test('istenen saatin tahmini ve günün min/max değerleri seçilir', async () => {
  setWeatherFetcherForTests(async () => ({
    ok: true, status: 200,
    json: async () => ({
      current: { time: '2026-11-10T08:00', temperature_2m: 9, apparent_temperature: 7, weather_code: 3, wind_speed_10m: 12 },
      hourly: {
        time: ['2026-11-10T08:00', '2026-11-11T19:00'],
        temperature_2m: [9, 4], apparent_temperature: [7, 1], precipitation_probability: [10, 85], weather_code: [3, 81], wind_speed_10m: [12, 20],
      },
      daily: {
        time: ['2026-11-10', '2026-11-11'],
        temperature_2m_max: [12, 8], temperature_2m_min: [5, 2], apparent_temperature_max: [10, 6], apparent_temperature_min: [3, -1],
        precipitation_probability_max: [20, 90], weather_code: [3, 81],
      },
    }),
  }));
  const w = await getWeather({ latitude: 41.2, longitude: 29.2, label: 'Test' }, '2026-11-11T19:30');
  setWeatherFetcherForTests(null);
  assert.equal(w.isForecast, true);
  assert.equal(w.feelsLikeC, 1);
  assert.equal(w.condition, 'Orta sağanak yağış');
  assert.equal(w.precipitationProbability, 85);
  assert.equal(w.maxC, 8);
});

test('2.2 kabul: 3°C yağışlı iş görüşmesi → sıcak dış giyim ve su geçirmezlik gerekli, resmiyet 4–5', () => {
  const ctx = buildContext({
    event: 'İş Görüşmesi',
    weather: weather({ temperatureC: 3, feelsLikeC: 1, weatherCode: 63, condition: 'Orta şiddetli yağmur', precipitationProbability: 90 }),
  });
  assert.equal(ctx.tempBand, 'freezing');
  assert.equal(ctx.outerwear, 'required');
  assert.ok((ctx.minOuterWarmth ?? 0) >= 4);
  assert.equal(ctx.needsWaterResistant, true);
  assert.ok(ctx.formality.min >= 4 && ctx.formality.max === 5);
});

test('eski 1-10 efor değeri özen düzeyine çevrilir; sıcak havada dış giyimden kaçınılır', () => {
  const ctx = buildContext({ event: 'Gündelik', effort: 10, weather: weather({ temperatureC: 32, feelsLikeC: 34, weatherCode: 0 }) });
  assert.equal(ctx.dressiness, 5);
  assert.equal(ctx.formality.target, 3);
  assert.equal(ctx.tempBand, 'hot');
  assert.equal(ctx.outerwear, 'avoid');
  assert.equal(tempBandFor(16), 'cool');
});
