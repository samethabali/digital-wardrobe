import type { TripDay, TripPackingGroup, TripPlanResponse, WeatherSnapshot, WardrobeItemDTO } from '../../shared/api.js';
import { CATEGORY_LABELS, EVENTS } from '../../shared/wardrobe.js';
import { getDailyForecast, resolveLocation } from '../weather.js';
import { addDays, daysBetween, isValidLocalDate, localDate } from '../time.js';
import { RequestError, sanitizeStylistRequest } from './request.js';
import { loadWardrobe, runEngine, WardrobeSnapshot } from './generate.js';
import type { ScoredOutfit } from './builder.js';
import { deterministicReason, deterministicTitle } from './explain.js';
import type { StyleContext } from './context.js';

export const MAX_TRIP_DAYS = 14;
/** Open-Meteo 16 günlük tahmin verir; bugün dahil */
export const FORECAST_HORIZON_DAYS = 15;

export interface TripRequest {
  location: unknown;
  startDate: string;
  endDate: string;
  event: string;
  dressiness?: number;
}

export function sanitizeTripRequest(raw: any, today = localDate()): TripRequest {
  if (!raw || typeof raw !== 'object') throw new RequestError('Seyahat bilgileri eksik.');
  const { startDate, endDate } = raw;
  if (!isValidLocalDate(startDate) || !isValidLocalDate(endDate)) throw new RequestError('Başlangıç ve bitiş tarihi YYYY-AA-GG olmalı.');
  if (startDate < today) throw new RequestError('Seyahat başlangıcı geçmiş bir tarih olamaz.');
  if (endDate < startDate) throw new RequestError('Bitiş tarihi başlangıçtan önce olamaz.');
  if (daysBetween(startDate, endDate) + 1 > MAX_TRIP_DAYS) throw new RequestError(`En fazla ${MAX_TRIP_DAYS} günlük seyahat planlanabilir.`);
  if (!raw.location) throw new RequestError('Seyahat konumu seçilmeli.');
  const event = typeof raw.event === 'string' && (EVENTS as readonly string[]).includes(raw.event) ? raw.event : 'Seyahat';
  const dressiness = Number.isInteger(raw.dressiness) && raw.dressiness >= 1 && raw.dressiness <= 5 ? raw.dressiness : undefined;
  return { location: raw.location, startDate, endDate, event, dressiness };
}

export function tripDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  for (let d = startDate; d <= endDate; d = addDays(d, 1)) dates.push(d);
  return dates;
}

export interface DayCandidates {
  date: string;
  weather: WeatherSnapshot | null;
  candidates: ScoredOutfit[];
  ctx?: StyleContext;
}

export interface PlannedDay {
  date: string;
  weather: WeatherSnapshot | null;
  outfit: ScoredOutfit | null;
}

/** Bavulda zaten olan parçaları tekrar kullanmanın puan karşılığı (parça başına) */
export const REUSE_BONUS = 4;
/** Bir önceki günle birebir aynı üst parçayı giymenin cezası */
export const REPEAT_TOP_PENALTY = 10;

const MAIN = new Set(['top', 'bottom', 'onepiece', 'outerwear', 'shoes']);

/**
 * Her gün için aday kombinlerden birini seçer (saf fonksiyon). Amaç: yüksek puan + az parçayla bavul.
 * Bavulda olan parçalar ödüllendirilir; ardışık günlerde aynı üst parça (tişört, gömlek, elbise) cezalandırılır.
 */
export function chooseTripOutfits(days: DayCandidates[]): PlannedDay[] {
  const packed = new Set<string>();
  let previousTop: string | null = null;
  const planned: PlannedDay[] = [];
  for (const day of days) {
    let best: ScoredOutfit | null = null;
    let bestValue = -Infinity;
    for (const outfit of day.candidates) {
      const main = outfit.items.filter(i => MAIN.has(i.category));
      const reused = main.filter(i => packed.has(i.id)).length;
      const top = outfit.items.find(i => i.category === 'top' || i.category === 'onepiece')?.id || null;
      const value = outfit.breakdown.total + REUSE_BONUS * reused - (top && top === previousTop ? REPEAT_TOP_PENALTY : 0);
      if (value > bestValue) { bestValue = value; best = outfit; }
    }
    if (best) {
      for (const item of best.items) packed.add(item.id);
      previousTop = best.items.find(i => i.category === 'top' || i.category === 'onepiece')?.id || null;
    } else {
      previousTop = null;
    }
    planned.push({ date: day.date, weather: day.weather, outfit: best });
  }
  return planned;
}

const PACKING_ORDER = ['outerwear', 'top', 'onepiece', 'bottom', 'shoes', 'accessory', 'makeup'];

export function buildPackingList(planned: PlannedDay[], dtoById: Map<string, WardrobeItemDTO>): TripPackingGroup[] {
  const usage = new Map<string, number>();
  for (const day of planned) for (const id of day.outfit?.itemIds || []) usage.set(id, (usage.get(id) || 0) + 1);
  const groups = new Map<string, TripPackingGroup>();
  for (const [id, days] of usage) {
    const dto = dtoById.get(id);
    if (!dto) continue;
    const category = String(dto.category);
    if (!groups.has(category)) groups.set(category, { category, label: CATEGORY_LABELS[category] || category, items: [] });
    groups.get(category)!.items.push({ ...dto, days });
  }
  return Array.from(groups.values())
    .map(g => ({ ...g, items: g.items.sort((a, b) => b.days - a.days) }))
    .sort((a, b) => PACKING_ORDER.indexOf(a.category) - PACKING_ORDER.indexOf(b.category));
}

export function packingTips(planned: PlannedDay[]): string[] {
  const tips: string[] = [];
  const weathers = planned.map(d => d.weather).filter(Boolean) as WeatherSnapshot[];
  if (weathers.some(w => (w.precipitationProbability ?? 0) >= 50)) tips.push('Yağış olasılığı yüksek günler var: katlanır şemsiye al.');
  const mins = weathers.map(w => w.minC).filter((v): v is number => typeof v === 'number');
  const maxs = weathers.map(w => w.maxC).filter((v): v is number => typeof v === 'number');
  if (mins.length && maxs.length && Math.max(...maxs) - Math.min(...mins) >= 12) {
    tips.push('Gün içi sıcaklık farkı büyük: çıkarıp takılabilen ince bir katman işine yarar.');
  }
  if (planned.length >= 5) tips.push('Uzun seyahat: en az bir kez yıkama imkânı varsa üst parça sayısını azaltabilirsin.');
  return tips;
}

/** Seyahat boyunca her gün için kombin ve tek bavul listesi. Kural motoru kullanılır (kota harcamaz). */
export async function planTrip(user: any, trip: TripRequest, wardrobe?: WardrobeSnapshot): Promise<TripPlanResponse> {
  const baseRequest = sanitizeStylistRequest({ event: trip.event, dressiness: trip.dressiness, location: trip.location });
  if (!baseRequest.location) throw new RequestError('Seyahat konumu geçersiz.');
  const resolved = await resolveLocation(baseRequest.location);
  if (!resolved) throw new RequestError('Seyahat konumu bulunamadı.', 404);

  const dates = tripDates(trip.startDate, trip.endDate);
  const warnings: string[] = [];
  let forecasts: Record<string, WeatherSnapshot | null> = {};
  try {
    forecasts = await getDailyForecast(resolved, dates);
  } catch {
    warnings.push('Hava durumu tahmini alınamadı; kombinler mevsime göre hazırlandı.');
  }
  const horizon = addDays(localDate(), FORECAST_HORIZON_DAYS);
  if (dates.some(d => d > horizon)) warnings.push('Tahmin penceresinin dışındaki günler için hava durumu kullanılamadı.');

  const snapshot = wardrobe || await loadWardrobe(user._id);
  const dayCandidates: DayCandidates[] = [];
  for (const date of dates) {
    const weather = forecasts[date] || null;
    try {
      // Tarih mevsim hesabı için verilir (hava tahmini zaten çözüldü)
      const run = await runEngine(user, { ...baseRequest, location: undefined, dateTime: `${date}T12:00`, ignoreWeather: !weather }, {
        mode: 'deterministic',
        candidateLimit: 8,
        weatherOverride: { weather, weatherError: null, resolved },
      }, snapshot);
      dayCandidates.push({ date, weather: run.ctx.weather, candidates: run.candidates, ctx: run.ctx });
      warnings.push(...run.warnings);
    } catch (err: any) {
      if (err instanceof RequestError && err.status === 422 && err.message.includes('gardırobuna')) throw err;
      dayCandidates.push({ date, weather, candidates: [] });
      warnings.push(`${date} için uygun kombin bulunamadı.`);
    }
  }

  const planned = chooseTripOutfits(dayCandidates);
  const days: TripDay[] = [];
  for (const day of planned) {
    if (!day.outfit) { days.push({ date: day.date, weather: day.weather, outfit: null, note: 'Uygun kombin bulunamadı.' }); continue; }
    const ctx = dayCandidates.find(d => d.date === day.date)?.ctx;
    days.push({
      date: day.date,
      weather: day.weather,
      note: null,
      outfit: {
        id: day.outfit.id,
        itemIds: day.outfit.itemIds,
        items: day.outfit.itemIds.map(id => snapshot.dtoById.get(id)).filter(Boolean),
        title: ctx ? deterministicTitle(day.outfit, ctx) : 'Seyahat kombini',
        reason: ctx ? deterministicReason(day.outfit, ctx) : '',
        score: day.outfit.breakdown.total,
        breakdown: day.outfit.breakdown,
      },
    });
  }

  return {
    locationLabel: resolved.label,
    days,
    packingList: buildPackingList(planned, snapshot.dtoById),
    tips: packingTips(planned),
    warnings: Array.from(new Set(warnings)),
  };
}
