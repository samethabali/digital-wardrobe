import type { LocationInput, WeatherSnapshot } from '../shared/api.js';
import { normalizeTr } from '../shared/wardrobe.js';
import { resolveTurkishLocation } from '../shared/turkeyLocations.js';

// Open-Meteo WMO hava kodları (https://open-meteo.com/en/docs) — tablonun tamamı
export const WMO_CODES: Record<number, string> = {
  0: 'Açık',
  1: 'Çoğunlukla açık',
  2: 'Parçalı bulutlu',
  3: 'Kapalı',
  45: 'Sisli',
  48: 'Kırağılı sis',
  51: 'Hafif çisenti',
  53: 'Orta çisenti',
  55: 'Yoğun çisenti',
  56: 'Hafif dondurucu çisenti',
  57: 'Yoğun dondurucu çisenti',
  61: 'Hafif yağmur',
  63: 'Orta şiddetli yağmur',
  65: 'Şiddetli yağmur',
  66: 'Hafif dondurucu yağmur',
  67: 'Şiddetli dondurucu yağmur',
  71: 'Hafif kar',
  73: 'Orta şiddetli kar',
  75: 'Yoğun kar',
  77: 'Kar taneleri',
  80: 'Hafif sağanak yağış',
  81: 'Orta sağanak yağış',
  82: 'Şiddetli sağanak yağış',
  85: 'Hafif kar sağanağı',
  86: 'Yoğun kar sağanağı',
  95: 'Gök gürültülü fırtına',
  96: 'Hafif dolulu fırtına',
  99: 'Şiddetli dolulu fırtına',
};

export const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
export const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);

export class WeatherError extends Error {}

type Fetcher = (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>;
let fetcher: Fetcher = (url) => fetch(url, { signal: AbortSignal.timeout(8000) });

export function setWeatherFetcherForTests(fake: Fetcher | null) {
  fetcher = fake || ((url) => fetch(url, { signal: AbortSignal.timeout(8000) }));
  geocodeCache.clear();
  forecastCache.clear();
}

export interface ResolvedLocation {
  latitude: number;
  longitude: number;
  label: string;
}

interface GeoResult {
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
  admin2?: string;
  country_code?: string;
}

const geocodeCache = new Map<string, { expires: number; data: GeoResult[] }>();

async function geocode(name: string): Promise<GeoResult[]> {
  const normKey = name.trim().toLowerCase();
  const cached = geocodeCache.get(normKey);
  if (cached && cached.expires > Date.now()) return cached.data;

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=10&language=tr&format=json&countryCode=TR`;
  const res = await fetcher(url);
  if (!res.ok) throw new WeatherError(`Konum servisi hata verdi (${res.status}).`);
  const data = await res.json();
  const results = Array.isArray(data?.results) ? data.results : [];
  if (geocodeCache.size > 200) geocodeCache.clear();
  geocodeCache.set(normKey, { expires: Date.now() + 24 * 60 * 60 * 1000, data: results });
  return results;
}

/**
 * Yerel il/ilçe veritabanındaki eşleşmeyi döndürür. İlçenin kesin koordinatı yoksa (il merkezi kullanılmışsa)
 * Open-Meteo'dan ilçenin kendi koordinatı istenir; servis yanıt vermezse yaklaşık konumla devam edilir.
 */
async function refineLocal(local: NonNullable<ReturnType<typeof resolveTurkishLocation>>): Promise<ResolvedLocation> {
  const approximate: ResolvedLocation = { latitude: local.latitude, longitude: local.longitude, label: local.label };
  if (!local.approximate || !local.district) return approximate;
  try {
    return (await findDistrict(local.province, local.district)) || approximate;
  } catch {
    return approximate;
  }
}

/**
 * Konum girdisini koordinata çevirir.
 * Önce yerel 81 il / 973 ilçe veritabanına bakılır; ilçenin kesin koordinatı yoksa Open-Meteo ile netleştirilir.
 * Yerelde bulunamayan yerler için doğrudan Open-Meteo Geocoding (countryCode=TR) kullanılır.
 */
export async function resolveLocation(input: LocationInput | string | undefined | null): Promise<ResolvedLocation | null> {
  if (!input) return null;
  const location: LocationInput = typeof input === 'string' ? { type: 'text', query: input } : input;

  if (location.type === 'coords') {
    if (!Number.isFinite(location.lat) || !Number.isFinite(location.lon)) return null;
    if (Math.abs(location.lat) > 90 || Math.abs(location.lon) > 180) return null;
    return { latitude: location.lat, longitude: location.lon, label: location.label || 'Mevcut konum' };
  }

  if (location.type === 'place') {
    const province = (location.province || '').trim();
    const district = (location.district || '').trim();
    if (!province) return null;

    // İlçe tek başına aranmaz: aynı adlı yer başka bir ilde de olabilir
    const local = (district ? resolveTurkishLocation(`${district}, ${province}`) : null)
      || resolveTurkishLocation(province);
    const localMatchesRequest = local && normalizeTr(local.province) === normalizeTr(province)
      && (!district || normalizeTr(local.district) === normalizeTr(district));
    if (local && localMatchesRequest) return refineLocal(local);

    if (district) {
      const found = await findDistrict(province, district);
      if (found) return found;
    }
    return (await findProvince(province)) || (local && normalizeTr(local.province) === normalizeTr(province)
      ? { latitude: local.latitude, longitude: local.longitude, label: local.label }
      : null);
  }

  const query = (location.query || '').trim();
  if (query.length < 2) return null;

  const parts = query.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const [first, second] = parts;
    // "İlçe, İl" ve eski istemcilerin "İl, İlçe" sırası
    const local = resolveTurkishLocation(`${first}, ${second}`) || resolveTurkishLocation(`${second}, ${first}`);
    if (local?.district) return refineLocal(local);
    return (await findDistrict(second, first))
      || (await findDistrict(first, second))
      || (await findProvince(second))
      || (await findProvince(first));
  }

  const local = resolveTurkishLocation(query);
  if (local) return refineLocal(local);
  const results = await geocode(query);
  return results[0] ? toResolved(results[0], query) : null;
}

async function findDistrict(province: string, district: string): Promise<ResolvedLocation | null> {
  const label = `${district}, ${province}`;
  const exact = await geocode(label);
  if (exact[0]) return toResolved(exact[0], label);
  // Yedek: ilçeyi tek başına ara, ilin eşleştiği sonucu seç (ör. "Kadıköy" Denizli'de de var)
  const loose = await geocode(district);
  const match = loose.find(r => normalizeTr(r.admin1) === normalizeTr(province));
  return match ? toResolved(match, label) : null;
}

async function findProvince(province: string): Promise<ResolvedLocation | null> {
  const results = await geocode(province);
  const wanted = normalizeTr(province);
  const match = results.find(r => normalizeTr(r.admin1) === wanted && normalizeTr(r.name) === wanted)
    || results.find(r => normalizeTr(r.admin1) === wanted);
  return match ? toResolved(match, province) : null;
}

function toResolved(result: GeoResult, label: string): ResolvedLocation {
  return { latitude: result.latitude, longitude: result.longitude, label };
}

// Aynı sunucu örneğinde kısa süreli önbellek (serverless örnekleri arasında paylaşılmaz)
const forecastCache = new Map<string, { expires: number; data: any }>();

async function fetchForecast(latitude: number, longitude: number): Promise<any> {
  const key = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  const cached = forecastCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data;

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m',
    hourly: 'temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m',
    daily: 'temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,weather_code',
    timezone: 'auto',
    forecast_days: '16',
  });
  const res = await fetcher(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!res.ok) throw new WeatherError(`Hava durumu servisi hata verdi (${res.status}).`);
  const data = await res.json();
  if (forecastCache.size > 200) forecastCache.clear();
  forecastCache.set(key, { expires: Date.now() + 30 * 60 * 1000, data });
  return data;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Konum için hava durumu. dateTime (yerel "YYYY-MM-DDTHH:mm") verilirse o saatin tahmini,
 * verilmezse anlık değerler kullanılır. 16 günden uzak tarihler için hata fırlatır.
 */
export async function getWeather(location: ResolvedLocation, dateTime?: string): Promise<WeatherSnapshot> {
  const data = await fetchForecast(location.latitude, location.longitude);
  const hourlyTimes: string[] = data?.hourly?.time || [];
  const dailyTimes: string[] = data?.daily?.time || [];

  let hourIndex = -1;
  let isForecast = false;
  if (dateTime) {
    const target = `${dateTime.slice(0, 13)}:00`;
    hourIndex = hourlyTimes.indexOf(target);
    if (hourIndex === -1) throw new WeatherError('Seçilen tarih için tahmin yok (en fazla 16 gün sonrası).');
    isForecast = true;
  } else {
    const currentTime: string | undefined = data?.current?.time;
    if (currentTime) hourIndex = hourlyTimes.indexOf(`${currentTime.slice(0, 13)}:00`);
  }

  const date = dateTime ? dateTime.slice(0, 10) : (data?.current?.time || '').slice(0, 10);
  const dayIndex = dailyTimes.indexOf(date);

  const hourly = data?.hourly || {};
  const current = data?.current || {};
  const daily = data?.daily || {};

  const temperature = isForecast ? num(hourly.temperature_2m?.[hourIndex]) : num(current.temperature_2m);
  const feelsLike = isForecast ? num(hourly.apparent_temperature?.[hourIndex]) : num(current.apparent_temperature);
  const code = isForecast ? num(hourly.weather_code?.[hourIndex]) : num(current.weather_code);
  const wind = isForecast ? num(hourly.wind_speed_10m?.[hourIndex]) : num(current.wind_speed_10m);

  if (temperature === null || code === null) {
    throw new WeatherError('Hava durumu verisi eksik geldi.');
  }

  // Yağış olasılığı: seçilen saat, yoksa günün en yükseği
  const hourlyPrecip = hourIndex >= 0 ? num(hourly.precipitation_probability?.[hourIndex]) : null;
  const dailyPrecip = dayIndex >= 0 ? num(daily.precipitation_probability_max?.[dayIndex]) : null;

  return {
    locationLabel: location.label,
    latitude: location.latitude,
    longitude: location.longitude,
    time: isForecast ? `${dateTime!.slice(0, 13)}:00` : (current.time || ''),
    isForecast,
    temperatureC: Math.round(temperature * 10) / 10,
    feelsLikeC: Math.round((feelsLike ?? temperature) * 10) / 10,
    minC: dayIndex >= 0 ? num(daily.temperature_2m_min?.[dayIndex]) : null,
    maxC: dayIndex >= 0 ? num(daily.temperature_2m_max?.[dayIndex]) : null,
    precipitationProbability: hourlyPrecip ?? dailyPrecip,
    weatherCode: code,
    condition: WMO_CODES[code] || 'Bilinmeyen hava durumu',
    windKmh: wind,
  };
}

/** Birden çok günün (seyahat planı) günlük özetini döndürür. */
export async function getDailyForecast(location: ResolvedLocation, dates: string[]): Promise<Record<string, WeatherSnapshot | null>> {
  const data = await fetchForecast(location.latitude, location.longitude);
  const daily = data?.daily || {};
  const times: string[] = daily.time || [];
  const result: Record<string, WeatherSnapshot | null> = {};
  for (const date of dates) {
    const i = times.indexOf(date);
    if (i === -1) { result[date] = null; continue; }
    const max = num(daily.temperature_2m_max?.[i]);
    const min = num(daily.temperature_2m_min?.[i]);
    const feelsMax = num(daily.apparent_temperature_max?.[i]);
    const feelsMin = num(daily.apparent_temperature_min?.[i]);
    const code = num(daily.weather_code?.[i]);
    if (max === null || min === null || code === null) { result[date] = null; continue; }
    // Gündüz koşulunu temsil etmek için en yüksek ile en düşüğün ağırlıklı ortalaması
    const representative = min + (max - min) * 0.6;
    const feels = feelsMax !== null && feelsMin !== null ? feelsMin + (feelsMax - feelsMin) * 0.6 : representative;
    result[date] = {
      locationLabel: location.label,
      latitude: location.latitude,
      longitude: location.longitude,
      time: `${date}T12:00`,
      isForecast: true,
      temperatureC: Math.round(representative * 10) / 10,
      feelsLikeC: Math.round(feels * 10) / 10,
      minC: min,
      maxC: max,
      precipitationProbability: num(daily.precipitation_probability_max?.[i]),
      weatherCode: code,
      condition: WMO_CODES[code] || 'Bilinmeyen hava durumu',
      windKmh: null,
    };
  }
  return result;
}
