import { FeedbackEventModel, PreferenceProfileModel, WearLogModel, ItemModel } from './db.js';
import type { Affinities, PreferenceData } from './engine/scoring.js';
import { generateJson } from './ai/gemini.js';
import { daysBetween, localDate } from './time.js';

export type ConsentKey = 'personalization' | 'personalColor' | 'push';

export function hasConsent(user: any, key: ConsentKey): boolean {
  return user?.consents?.[key]?.granted === true;
}

export const EMPTY_AFFINITIES = (): Affinities => ({ item: {}, colorFamily: {}, style: {}, fit: {}, pattern: {} });

const HALF_LIFE_DAYS = 60;
const MAX_ABS = 20;
const MAX_ITEM_KEYS = 500;

// Olay türüne göre öğrenme ağırlıkları
const EVENT_WEIGHTS: Record<string, number> = {
  saved: 2,
  worn: 3,
  liked: 2,
  disliked: -3,
  rerolled: -0.3,
};

type AttributeItem = { id: string; colorFamily?: string | null; style?: string; fit?: string; pattern?: string };

function bump(map: Record<string, number>, key: string | null | undefined, delta: number) {
  if (!key || key === 'belirsiz') return;
  map[key] = Math.max(-MAX_ABS, Math.min(MAX_ABS, (map[key] || 0) + delta));
}

/** Zamanla eski tercihlerin etkisini azaltır (60 günlük yarı ömür). */
export function applyDecay(aff: Affinities, days: number): Affinities {
  if (days <= 0) return aff;
  const factor = Math.pow(0.5, days / HALF_LIFE_DAYS);
  const decayMap = (map: Record<string, number>) => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(map || {})) {
      const next = v * factor;
      if (Math.abs(next) >= 0.05) out[k] = next;
    }
    return out;
  };
  return {
    item: decayMap(aff.item),
    colorFamily: decayMap(aff.colorFamily),
    style: decayMap(aff.style),
    fit: decayMap(aff.fit),
    pattern: decayMap(aff.pattern),
  };
}

export interface LearnEvent {
  type: string;
  itemIds: string[];
  itemId?: string;
  reason?: string;
}

/** Tek bir geri bildirim olayından eğilim puanlarını günceller (saf fonksiyon). */
export function updateAffinities(current: Affinities, event: LearnEvent, items: Map<string, AttributeItem>): Affinities {
  const aff: Affinities = {
    item: { ...current.item },
    colorFamily: { ...current.colorFamily },
    style: { ...current.style },
    fit: { ...current.fit },
    pattern: { ...current.pattern },
  };

  if (event.type === 'replaced' && event.itemId) {
    const item = items.get(event.itemId);
    bump(aff.item, event.itemId, -1.5);
    if (item) {
      bump(aff.colorFamily, item.colorFamily, -0.5);
      bump(aff.style, item.style, -0.5);
      bump(aff.fit, item.fit, -0.3);
      bump(aff.pattern, item.pattern, -0.3);
    }
  } else if (event.type in EVENT_WEIGHTS) {
    let weight = EVENT_WEIGHTS[event.type];
    // Hava veya resmiyet nedeniyle beğenilmeyen kombin parçaların kendisi hakkında az şey söyler
    if (event.type === 'disliked' && (event.reason === 'hava' || event.reason === 'resmiyet')) weight = -1;
    for (const id of event.itemIds) {
      const item = items.get(id);
      bump(aff.item, id, weight);
      if (!item) continue;
      bump(aff.colorFamily, item.colorFamily, weight * 0.5);
      bump(aff.style, item.style, weight * 0.5);
      bump(aff.fit, item.fit, weight * 0.3);
      bump(aff.pattern, item.pattern, weight * 0.3);
      if (event.type === 'disliked') {
        if (event.reason === 'renk') bump(aff.colorFamily, item.colorFamily, -1.5);
        if (event.reason === 'kesim') bump(aff.fit, item.fit, -1.5);
        if (event.reason === 'tarz') bump(aff.style, item.style, -1.5);
      }
    }
  }

  // Parça haritası sınırsız büyümesin
  const itemEntries = Object.entries(aff.item);
  if (itemEntries.length > MAX_ITEM_KEYS) {
    aff.item = Object.fromEntries(itemEntries.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, MAX_ITEM_KEYS));
  }
  return aff;
}

/** Puanlayıcının kullandığı tercih verisi. Öğrenilmiş eğilimler yalnızca kişiselleştirme rızası varsa yüklenir. */
export async function loadPreferenceData(user: any): Promise<PreferenceData> {
  const style = user?.styleProfile || {};
  const personalColor = hasConsent(user, 'personalColor') ? style.personalColor : null;
  let affinities: Affinities | null = null;
  if (hasConsent(user, 'personalization')) {
    const profile: any = await PreferenceProfileModel.findOne({ userId: user._id } as any).lean();
    if (profile?.affinities) {
      const days = profile.updatedAt ? (Date.now() - new Date(profile.updatedAt).getTime()) / 86_400_000 : 0;
      affinities = applyDecay({ ...EMPTY_AFFINITIES(), ...profile.affinities }, days);
    }
  }
  return {
    affinities,
    preferredFits: style.preferredFits || [],
    avoidFits: style.avoidFits || [],
    dislikedColorFamilies: style.dislikedColorFamilies || [],
    bestColorFamilies: personalColor?.bestColorFamilies || [],
    avoidColorFamilies: personalColor?.avoidColorFamilies || [],
  };
}

export async function preferenceSummary(user: any): Promise<string | null> {
  if (!hasConsent(user, 'personalization')) return null;
  const profile: any = await PreferenceProfileModel.findOne({ userId: user._id } as any).select('summary').lean();
  return profile?.summary || null;
}

const SUMMARY_EVERY = 15;

function topEntries(map: Record<string, number>, sign: 1 | -1, limit = 3): string[] {
  return Object.entries(map || {})
    .filter(([, v]) => v * sign > 1)
    .sort((a, b) => (b[1] - a[1]) * sign)
    .slice(0, limit)
    .map(([k]) => k);
}

async function refreshSummary(profile: any) {
  const aff: Affinities = profile.affinities;
  const facts = {
    sevilenRenkler: topEntries(aff.colorFamily, 1),
    sevilmeyenRenkler: topEntries(aff.colorFamily, -1),
    sevilenStiller: topEntries(aff.style, 1),
    sevilmeyenStiller: topEntries(aff.style, -1),
    sevilenKesimler: topEntries(aff.fit, 1),
    sevilmeyenKesimler: topEntries(aff.fit, -1),
    sevilenDesenler: topEntries(aff.pattern, 1),
    sevilmeyenDesenler: topEntries(aff.pattern, -1),
  };
  const { data } = await generateJson<{ summary: string }>({
    task: 'light',
    label: 'preference_summary',
    contents: `Kullanıcının kombin geri bildirimlerinden çıkarılan eğilimler:\n${JSON.stringify(facts)}\n\nBu eğilimleri bir stilistin not defterine yazacağı gibi, 2 kısa Türkçe cümleyle özetle. Veride olmayan bir şey ekleme.`,
    schema: { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] },
  });
  profile.summary = String(data.summary || '').slice(0, 300);
  profile.summaryEventCount = profile.eventCount;
  profile.summaryUpdatedAt = new Date();
}

/**
 * Geri bildirimi kaydeder ve tercih profilini günceller. Kişiselleştirme rızası yoksa hiçbir şey saklanmaz.
 */
export async function recordFeedback(user: any, event: LearnEvent & { generationId?: string; note?: string; context?: unknown }): Promise<{ stored: boolean }> {
  if (!hasConsent(user, 'personalization')) return { stored: false };

  const ids = Array.from(new Set([...(event.itemIds || []), ...(event.itemId ? [event.itemId] : [])]));
  const ownedItems: any[] = await ItemModel.find({ userId: user._id, id: { $in: ids } } as any)
    .select('id colorFamily style fit pattern').lean();
  const items = new Map(ownedItems.map(i => [i.id, i]));
  const itemIds = (event.itemIds || []).filter(id => items.has(id));
  const itemId = event.itemId && items.has(event.itemId) ? event.itemId : undefined;

  await FeedbackEventModel.create({
    userId: user._id,
    type: event.type,
    generationId: event.generationId,
    itemIds,
    itemId,
    reason: event.reason,
    note: event.note?.slice(0, 300),
    context: event.context,
  });

  let profile: any = await PreferenceProfileModel.findOne({ userId: user._id } as any);
  if (!profile) profile = new PreferenceProfileModel({ userId: user._id, affinities: EMPTY_AFFINITIES() });
  const days = profile.updatedAt ? (Date.now() - new Date(profile.updatedAt).getTime()) / 86_400_000 : 0;
  const current = applyDecay({ ...EMPTY_AFFINITIES(), ...(profile.affinities?.toObject?.() || profile.affinities || {}) }, days);
  profile.affinities = updateAffinities(current, { ...event, itemIds, itemId }, items);
  profile.markModified('affinities');
  profile.eventCount = (profile.eventCount || 0) + 1;
  profile.updatedAt = new Date();

  if (profile.eventCount - (profile.summaryEventCount || 0) >= SUMMARY_EVERY) {
    await refreshSummary(profile).catch(err => console.warn('[Preferences] Özet üretilemedi:', err?.message));
  }
  await profile.save();
  return { stored: true };
}

/** Kişiselleştirme rızası varsa, gösterilen kombinleri tekrar önleme için kaydeder. */
export async function logShownOutfits(user: any, generationId: string, outfits: string[][], context: unknown) {
  if (!hasConsent(user, 'personalization') || outfits.length === 0) return;
  await FeedbackEventModel.insertMany(outfits.map(itemIds => ({
    userId: user._id, type: 'shown', generationId, itemIds, context, createdAt: new Date(),
  })));
}

export async function recentShownOutfits(user: any, hours = 72, limit = 20): Promise<string[][]> {
  if (!hasConsent(user, 'personalization')) return [];
  const since = new Date(Date.now() - hours * 3_600_000);
  const events: any[] = await FeedbackEventModel.find({ userId: user._id, type: { $in: ['shown', 'worn'] }, createdAt: { $gte: since } } as any)
    .sort({ createdAt: -1 } as any).limit(limit).select('itemIds').lean();
  return events.map(e => e.itemIds || []);
}

/** Giyim günlüğüne göre parça → kaç gün önce giyildi. Giyim günlüğü kullanıcının açık eylemidir, rıza gerektirmez. */
export async function recentlyWornMap(userId: unknown, days = 3): Promise<Map<string, number>> {
  const today = localDate();
  const logs: any[] = await WearLogModel.find({ userId } as any).sort({ date: -1 } as any).limit(20).select('date itemIds').lean();
  const map = new Map<string, number>();
  for (const log of logs) {
    const ago = daysBetween(log.date, today);
    if (ago < 0 || ago > days) continue;
    for (const id of log.itemIds || []) {
      if (!map.has(id) || map.get(id)! > ago) map.set(id, ago);
    }
  }
  return map;
}
