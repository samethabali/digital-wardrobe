import type { ContextSummary, TempBand, WeatherSnapshot } from '../../shared/api.js';
import { EVENTS, EventKey, Season, normalizeTr, seasonForDate } from '../../shared/wardrobe.js';
import { RAIN_CODES, SNOW_CODES } from '../weather.js';

export type OuterwearNeed = 'required' | 'recommended' | 'optional' | 'avoid';

export interface StyleContext {
  event: EventKey | 'Özel';
  eventLabel: string;
  formality: { min: number; max: number; target: number };
  dressiness: number;
  activity: number;
  mood: string | null;
  styleTags: string[];
  personalContext: string | null;
  eventNotes: string | null;
  indoor: boolean;
  weather: WeatherSnapshot | null;
  ignoreWeather: boolean;
  tempBand: TempBand | null;
  precipitation: 'none' | 'rain' | 'snow';
  outerwear: OuterwearNeed;
  /** Dış giyim varsa en az bu sıcak tutma değerinde olmalı */
  minOuterWarmth: number | null;
  /** Üst (veya tek parça) + dış katman toplam sıcak tutma aralığı */
  insulation: { min: number; max: number } | null;
  needsWaterResistant: boolean;
  season: Season;
}

interface EventPreset {
  formality: [number, number];
  activity: number;
}

export const EVENT_PRESETS: Record<EventKey, EventPreset> = {
  'Gündelik': { formality: [1, 3], activity: 2 },
  'Ofis': { formality: [3, 4], activity: 2 },
  'İş Görüşmesi': { formality: [4, 5], activity: 1 },
  'Randevu': { formality: [2, 4], activity: 2 },
  'Parti': { formality: [2, 4], activity: 3 },
  'Düğün/Davet': { formality: [4, 5], activity: 2 },
  'Spor': { formality: [1, 1], activity: 5 },
  'Seyahat': { formality: [1, 3], activity: 3 },
  'Okul': { formality: [1, 3], activity: 2 },
};

const EVENT_ALIASES: Array<[string[], EventKey]> = [
  [['iş görüşmesi', 'mülakat', 'mulakat'], 'İş Görüşmesi'],
  [['düğün', 'davet', 'nişan', 'kına', 'gala'], 'Düğün/Davet'],
  [['ofis', 'toplantı', 'iş yeri', 'işyeri', 'business'], 'Ofis'],
  [['randevu', 'buluşma', 'date', 'akşam yemeği'], 'Randevu'],
  [['parti', 'gece', 'kulüp', 'konser', 'doğum günü'], 'Parti'],
  [['spor', 'gym', 'koşu', 'yürüyüş', 'antrenman', 'fitness'], 'Spor'],
  [['seyahat', 'tatil', 'uçak', 'yolculuk', 'gezi'], 'Seyahat'],
  [['okul', 'kampüs', 'üniversite', 'ders'], 'Okul'],
  [['gündelik', 'günlük', 'casual'], 'Gündelik'],
];

export function resolveEventKey(event: string | undefined | null): EventKey | null {
  const text = normalizeTr(event);
  if (!text) return null;
  const direct = EVENTS.find(e => normalizeTr(e) === text);
  if (direct) return direct;
  for (const [aliases, key] of EVENT_ALIASES) {
    if (aliases.some(a => text.includes(a))) return key;
  }
  return null;
}

/** Hissedilen sıcaklığa göre sıcaklık bandı. */
export function tempBandFor(feelsLikeC: number): TempBand {
  if (feelsLikeC <= 3) return 'freezing';
  if (feelsLikeC <= 10) return 'cold';
  if (feelsLikeC <= 16) return 'cool';
  if (feelsLikeC <= 22) return 'mild';
  if (feelsLikeC <= 28) return 'warm';
  return 'hot';
}

const INSULATION: Record<TempBand, { min: number; max: number }> = {
  hot: { min: 1, max: 2 },
  warm: { min: 2, max: 3 },
  mild: { min: 2, max: 5 },
  cool: { min: 4, max: 6 },
  cold: { min: 6, max: 8 },
  freezing: { min: 7, max: 10 },
};

const OUTERWEAR_NEED: Record<TempBand, OuterwearNeed> = {
  hot: 'avoid',
  warm: 'optional',
  mild: 'optional',
  cool: 'recommended',
  cold: 'required',
  freezing: 'required',
};

const MIN_OUTER_WARMTH: Record<TempBand, number | null> = {
  hot: null,
  warm: null,
  mild: null,
  cool: 2,
  cold: 3,
  freezing: 4,
};

export interface ContextInput {
  event?: string;
  eventOverride?: { formalityMin?: number; formalityMax?: number; activity?: number; indoor?: boolean; notes?: string } | null;
  dressiness?: number;
  activity?: number;
  effort?: number;
  mood?: string;
  styleTags?: string[];
  personalContext?: string;
  ignoreWeather?: boolean;
  weather: WeatherSnapshot | null;
  date?: Date;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const scale = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? clamp(Math.round(v), 1, 5) : fallback);

export function precipitationFor(weather: WeatherSnapshot): 'none' | 'rain' | 'snow' {
  if (SNOW_CODES.has(weather.weatherCode)) return 'snow';
  if (RAIN_CODES.has(weather.weatherCode)) {
    // Donma noktasına yakın yağış kar gibi değerlendirilir
    return weather.temperatureC <= 1 ? 'snow' : 'rain';
  }
  if ((weather.precipitationProbability ?? 0) >= 60) return weather.temperatureC <= 1 ? 'snow' : 'rain';
  return 'none';
}

export function buildContext(input: ContextInput): StyleContext {
  const eventKey = resolveEventKey(input.event);
  const preset = eventKey ? EVENT_PRESETS[eventKey] : EVENT_PRESETS['Gündelik'];
  const override = input.eventOverride || null;

  let formalityMin = override?.formalityMin ? clamp(Math.round(override.formalityMin), 1, 5) : preset.formality[0];
  let formalityMax = override?.formalityMax ? clamp(Math.round(override.formalityMax), 1, 5) : preset.formality[1];
  if (formalityMin > formalityMax) [formalityMin, formalityMax] = [formalityMax, formalityMin];

  // Eski istemciler 1-10 "efor" gönderir; özen düzeyine çevrilir
  const legacyDressiness = typeof input.effort === 'number' ? Math.ceil(clamp(input.effort, 1, 10) / 2) : 3;
  const dressiness = scale(input.dressiness, legacyDressiness);
  const target = Math.round((formalityMin + (formalityMax - formalityMin) * (dressiness - 1) / 4) * 10) / 10;
  const activity = scale(input.activity, override?.activity ? clamp(Math.round(override.activity), 1, 5) : preset.activity);

  const indoor = Boolean(override?.indoor);
  const ignoreWeather = Boolean(input.ignoreWeather);
  const weather = ignoreWeather ? null : input.weather;

  let tempBand: TempBand | null = null;
  let precipitation: 'none' | 'rain' | 'snow' = 'none';
  let outerwear: OuterwearNeed = 'optional';
  let minOuterWarmth: number | null = null;
  let insulation: { min: number; max: number } | null = null;
  let needsWaterResistant = false;

  if (weather) {
    tempBand = tempBandFor(weather.feelsLikeC);
    precipitation = precipitationFor(weather);
    outerwear = OUTERWEAR_NEED[tempBand];
    minOuterWarmth = MIN_OUTER_WARMTH[tempBand];
    insulation = INSULATION[tempBand];
    needsWaterResistant = precipitation !== 'none';
    if (precipitation !== 'none' && outerwear === 'optional') outerwear = 'recommended';
    // Kapalı mekan etkinliğinde dış giyim yol için gereklidir ama zorunlu tutulmaz
    if (indoor && outerwear === 'required') outerwear = 'recommended';
  }

  const date = input.date || (weather?.time ? new Date(weather.time) : new Date());

  return {
    event: eventKey || 'Özel',
    eventLabel: (input.event || '').trim() || 'Gündelik',
    formality: { min: formalityMin, max: formalityMax, target },
    dressiness,
    activity,
    mood: input.mood?.trim() || null,
    styleTags: (input.styleTags || []).filter(t => typeof t === 'string').slice(0, 10),
    personalContext: input.personalContext?.trim().slice(0, 1000) || null,
    eventNotes: override?.notes?.trim().slice(0, 300) || null,
    indoor,
    weather,
    ignoreWeather,
    tempBand,
    precipitation,
    outerwear,
    minOuterWarmth,
    insulation,
    needsWaterResistant,
    season: seasonForDate(Number.isNaN(date.getTime()) ? new Date() : date),
  };
}

export function summarizeContext(ctx: StyleContext): ContextSummary {
  return {
    event: ctx.eventLabel,
    formalityMin: ctx.formality.min,
    formalityMax: ctx.formality.max,
    formalityTarget: ctx.formality.target,
    activity: ctx.activity,
    tempBand: ctx.tempBand,
    precipitation: ctx.precipitation,
    outerwear: ctx.outerwear,
    needsWaterResistant: ctx.needsWaterResistant,
    season: ctx.season,
    feelsLikeC: ctx.weather ? ctx.weather.feelsLikeC : null,
    indoor: ctx.indoor,
  };
}

export const TEMP_BAND_LABELS: Record<TempBand, string> = {
  freezing: 'dondurucu soğuk',
  cold: 'soğuk',
  cool: 'serin',
  mild: 'ılık',
  warm: 'sıcak',
  hot: 'çok sıcak',
};

// Sıcaklık bandı için temsilî hissedilen sıcaklık (eski kayıtlarda feelsLikeC yoksa)
const BAND_FEELS_LIKE: Record<TempBand, number> = { freezing: 0, cold: 7, cool: 13, mild: 19, warm: 25, hot: 32 };

/**
 * Kaydedilmiş bağlam özetinden puanlayıcının kullanabileceği bağlamı yeniden kurar
 * (yeniden sıralayıcı eğitimi gibi çevrimdışı işler için; gerçek hava verisi yerine temsilî değerler).
 */
export function contextFromSummary(summary: Partial<ContextSummary> | null | undefined): StyleContext {
  const band = summary?.tempBand || null;
  const feels = typeof summary?.feelsLikeC === 'number' ? summary.feelsLikeC : band ? BAND_FEELS_LIKE[band] : null;
  const code = summary?.precipitation === 'snow' ? 71 : summary?.precipitation === 'rain' ? 61 : 2;
  const weather: WeatherSnapshot | null = feels === null ? null : {
    locationLabel: '', latitude: 0, longitude: 0, time: '', isForecast: false,
    temperatureC: feels, feelsLikeC: feels, minC: null, maxC: null,
    precipitationProbability: summary?.precipitation && summary.precipitation !== 'none' ? 80 : 0,
    weatherCode: code, condition: '', windKmh: null,
  };
  const seasonMonth: Record<string, number> = { ilkbahar: 3, yaz: 6, sonbahar: 9, 'kış': 0 };
  const month = summary?.season && summary.season in seasonMonth ? seasonMonth[summary.season] : undefined;
  return buildContext({
    event: summary?.event || 'Gündelik',
    eventOverride: summary?.formalityMin && summary?.formalityMax
      ? { formalityMin: summary.formalityMin, formalityMax: summary.formalityMax, activity: summary.activity, indoor: summary.indoor }
      : null,
    activity: summary?.activity,
    weather,
    ignoreWeather: weather === null,
    date: month === undefined ? undefined : new Date(Date.UTC(2026, month, 15)),
  });
}
