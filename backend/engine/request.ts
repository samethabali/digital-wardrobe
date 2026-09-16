import type { LocationInput, StylistRequest } from '../../shared/api.js';
import { STYLE_TAGS, MOODS } from '../../shared/wardrobe.js';
import { isValidLocalDateTime, localDateTime } from '../time.js';

export class RequestError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const str = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : undefined);
const idList = (value: unknown, maxItems = 50) =>
  Array.isArray(value) ? value.filter(v => typeof v === 'string' && v.length <= 100).slice(0, maxItems) as string[] : [];

function sanitizeLocation(value: unknown): LocationInput | undefined {
  if (typeof value === 'string') {
    const query = value.trim().slice(0, 100);
    return query ? { type: 'text', query } : undefined;
  }
  if (!value || typeof value !== 'object') return undefined;
  const v = value as any;
  if (v.type === 'coords' && typeof v.lat === 'number' && typeof v.lon === 'number' && Number.isFinite(v.lat) && Number.isFinite(v.lon)) {
    if (Math.abs(v.lat) > 90 || Math.abs(v.lon) > 180) return undefined;
    return { type: 'coords', lat: v.lat, lon: v.lon, label: str(v.label, 80) };
  }
  if (v.type === 'place' && typeof v.province === 'string' && v.province.trim()) {
    return { type: 'place', province: v.province.trim().slice(0, 60), district: str(v.district, 60) || undefined };
  }
  if (v.type === 'text' && typeof v.query === 'string' && v.query.trim()) {
    return { type: 'text', query: v.query.trim().slice(0, 100) };
  }
  return undefined;
}

export interface CleanRequest {
  location?: LocationInput;
  dateTime?: string;
  event: string;
  eventText?: string;
  dressiness?: number;
  activity?: number;
  effort?: number;
  mood?: string;
  styleTags: string[];
  personalContext?: string;
  ignoreWeather: boolean;
  requiredItems: string[];
  lockedItems: string[];
  excludedItems: string[];
  recentOutfits: string[][];
}

/** İstemciden gelen isteği doğrular ve güvenli sınırlara çeker (eski mobil istemci biçimi de kabul edilir). */
export function sanitizeStylistRequest(raw: unknown): CleanRequest {
  if (!raw || typeof raw !== 'object') throw new RequestError('Kombin isteği eksik.');
  const r = raw as StylistRequest & Record<string, unknown>;

  let dateTime: string | undefined;
  if (r.dateTime !== undefined && r.dateTime !== null && r.dateTime !== '') {
    if (!isValidLocalDateTime(r.dateTime)) throw new RequestError('Tarih ve saat biçimi geçersiz.');
    const now = localDateTime();
    const max = localDateTime(new Date(Date.now() + 15 * 86_400_000));
    // Geçmiş günler ve 16 günlük tahmin penceresinin dışı reddedilir; bugünün geçmiş saatleri "şimdi" sayılır
    if (r.dateTime.slice(0, 10) < now.slice(0, 10)) throw new RequestError('Geçmiş bir tarih için kombin planlanamaz.');
    if (r.dateTime > max) throw new RequestError('En fazla 15 gün sonrası için planlama yapılabilir.');
    dateTime = r.dateTime.slice(0, 13) <= now.slice(0, 13) ? undefined : r.dateTime;
  }

  const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
  const mood = str(r.mood, 30);

  return {
    location: sanitizeLocation(r.location),
    dateTime,
    event: str(r.event, 60) || 'Gündelik',
    eventText: str(r.eventText, 300) || undefined,
    dressiness: num(r.dressiness),
    activity: num(r.activity),
    effort: num(r.effort),
    mood: mood && (MOODS as readonly string[]).includes(mood) ? mood : undefined,
    styleTags: Array.isArray(r.styleTags) ? r.styleTags.filter(t => typeof t === 'string' && STYLE_TAGS.includes(t)).slice(0, 10) : [],
    personalContext: str(r.personalContext, 1000) || undefined,
    ignoreWeather: r.ignoreWeather === true,
    requiredItems: idList(r.requiredItems),
    lockedItems: idList(r.lockedItems),
    excludedItems: idList(r.excludedItems, 100),
    recentOutfits: Array.isArray(r.recentOutfits)
      ? r.recentOutfits.filter(Array.isArray).slice(0, 10).map(o => idList(o, 10))
      : [],
  };
}
