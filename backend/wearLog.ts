import { ItemModel, WearLogModel } from './db.js';
import { RequestError } from './engine/request.js';
import { addDays, daysBetween, isValidLocalDate, localDate } from './time.js';
import { cosine } from './ai/gemini.js';
import { kmeans } from './embeddings.js';
import { STYLE_LABELS, missingFields } from '../shared/wardrobe.js';
import type { StyleCluster, WardrobeStats, WearLogEntry, WornItemStat } from '../shared/api.js';

export const WEAR_LOG_MAX_AGE_DAYS = 365;

export interface WearInput {
  date: string;
  itemIds: string[];
  outfitId?: string;
  source: WearLogEntry['source'];
  note?: string;
}

export function toWearLogEntry(doc: any): WearLogEntry {
  return {
    id: doc._id.toString(),
    date: doc.date,
    itemIds: doc.itemIds || [],
    outfitId: doc.outfitId || null,
    source: doc.source || 'manual',
    note: doc.note || null,
    createdAt: new Date(doc.createdAt).toISOString(),
  };
}

/** Elle giyim kaydı gövdesini doğrular. */
export function sanitizeWearInput(raw: any, today = localDate()): WearInput {
  const date = raw?.date === undefined || raw?.date === '' ? today : raw.date;
  if (!isValidLocalDate(date)) throw new RequestError('Tarih YYYY-AA-GG biçiminde olmalı.');
  const age = daysBetween(date, today);
  if (age < 0) throw new RequestError('İleri bir tarih için giyim kaydı eklenemez.');
  if (age > WEAR_LOG_MAX_AGE_DAYS) throw new RequestError('En fazla 1 yıl öncesine kayıt eklenebilir.');
  if (!Array.isArray(raw?.itemIds) || raw.itemIds.length === 0 || raw.itemIds.length > 12
    || raw.itemIds.some((id: unknown) => typeof id !== 'string' || id.length > 100)) {
    throw new RequestError('Giyilen parçaları seç (en fazla 12).');
  }
  const outfitId = typeof raw?.outfitId === 'string' && raw.outfitId.length <= 100 ? raw.outfitId : undefined;
  const note = typeof raw?.note === 'string' && raw.note.trim() ? raw.note.trim().slice(0, 300) : undefined;
  const source = raw?.source === 'saved' ? 'saved' : 'manual';
  return { date, itemIds: Array.from(new Set(raw.itemIds as string[])), outfitId, source, note };
}

/** Günün öğlesi (UTC): lastWornAt karşılaştırmaları için tarih → Date. */
const dateToInstant = (date: string) => new Date(`${date}T12:00:00Z`);

/**
 * Giyim kaydı ekler. Yalnızca kullanıcının kendi parçaları kaydedilir. Aynı gün aynı parça grubu ikinci kez
 * gönderilirse (ör. butona iki kez basıldı) yeni kayıt açılmaz ve giyilme sayısı artmaz.
 */
export async function recordWear(userId: unknown, input: WearInput): Promise<WearLogEntry> {
  const owned: any[] = await ItemModel.find({ userId, id: { $in: input.itemIds } } as any).select('id').lean();
  const ownedIds = new Set(owned.map(i => i.id));
  const itemIds = input.itemIds.filter(id => ownedIds.has(id));
  if (itemIds.length === 0) throw new RequestError('Seçilen parçalar gardırobunda bulunamadı.', 404);

  const sorted = [...itemIds].sort();
  const sameDay: any[] = await WearLogModel.find({ userId, date: input.date } as any).lean();
  const duplicate = sameDay.find(log => {
    const ids = [...(log.itemIds || [])].sort();
    return ids.length === sorted.length && ids.every((id, i) => id === sorted[i]);
  });
  if (duplicate) return toWearLogEntry(duplicate);

  const log = await WearLogModel.create({
    userId, date: input.date, itemIds, outfitId: input.outfitId, source: input.source, note: input.note,
  });

  const wornAt = dateToInstant(input.date);
  await ItemModel.updateMany({ userId, id: { $in: itemIds } } as any, { $inc: { wearCount: 1 } });
  await ItemModel.updateMany(
    { userId, id: { $in: itemIds }, $or: [{ lastWornAt: { $exists: false } }, { lastWornAt: null }, { lastWornAt: { $lt: wornAt } }] } as any,
    { $set: { lastWornAt: wornAt } },
  );
  return toWearLogEntry(log);
}

/** Giyim kaydını siler; parçaların giyilme sayısını ve son giyilme tarihini kalan kayıtlara göre düzeltir. */
export async function deleteWear(userId: unknown, logId: string): Promise<boolean> {
  if (!/^[a-f0-9]{24}$/i.test(logId)) return false;
  const log: any = await WearLogModel.findOneAndDelete({ _id: logId, userId } as any).lean();
  if (!log) return false;
  const itemIds: string[] = log.itemIds || [];
  await ItemModel.updateMany({ userId, id: { $in: itemIds }, wearCount: { $gt: 0 } } as any, { $inc: { wearCount: -1 } });
  for (const id of itemIds) {
    const latest: any = await WearLogModel.findOne({ userId, itemIds: id } as any).sort({ date: -1 } as any).select('date').lean();
    await ItemModel.updateOne(
      { userId, id } as any,
      latest ? { $set: { lastWornAt: dateToInstant(latest.date) } } : { $unset: { lastWornAt: '' } },
    );
  }
  return true;
}

export async function listWear(userId: unknown, from: string, to: string): Promise<WearLogEntry[]> {
  const logs: any[] = await WearLogModel.find({ userId, date: { $gte: from, $lte: to } } as any)
    .sort({ date: -1, createdAt: -1 } as any).limit(400).lean();
  return logs.map(toWearLogEntry);
}

export function parseRange(query: any, today = localDate()): { from: string; to: string } {
  const to = isValidLocalDate(query?.to) ? query.to : today;
  const from = isValidLocalDate(query?.from) ? query.from : addDays(to, -30);
  if (from > to) throw new RequestError('Başlangıç tarihi bitişten sonra olamaz.');
  if (daysBetween(from, to) > WEAR_LOG_MAX_AGE_DAYS) throw new RequestError('En fazla 1 yıllık aralık sorgulanabilir.');
  return { from, to };
}

// ─── İstatistikler (saf hesap) ─────────────────────────────────────────────
function toWornStat(item: any): WornItemStat {
  const wearCount = typeof item.wearCount === 'number' ? item.wearCount : 0;
  const price = typeof item.price === 'number' && item.price > 0 ? item.price : null;
  return {
    id: item.id,
    name: item.name || 'Parça',
    category: item.category,
    imagePath: item.cutoutImagePath || item.imagePath || '',
    wearCount,
    lastWornAt: item.lastWornAt ? new Date(item.lastWornAt).toISOString() : null,
    price,
    costPerWear: price === null ? null : Math.round((price / Math.max(1, wearCount)) * 100) / 100,
  };
}

function mostCommon<T>(values: T[]): T | null {
  const counts = new Map<T, number>();
  for (const v of values) if (v !== null && v !== undefined) counts.set(v, (counts.get(v) || 0) + 1);
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** Görsel/metin embedding'lerinden stil kümeleri (en az 6 parça gerekir). */
export function styleClusters(items: any[]): StyleCluster[] {
  const embedded = items.filter(i => Array.isArray(i.embedding) && i.embedding.length > 0 && !['makeup'].includes(i.category));
  if (embedded.length < 6) return [];
  const k = Math.min(4, Math.floor(embedded.length / 3));
  const assignment = kmeans(embedded.map(i => i.embedding), k);
  const clusters: StyleCluster[] = [];
  for (let c = 0; c < k; c++) {
    const members = embedded.filter((_, i) => assignment[i] === c);
    if (members.length === 0) continue;
    const style = mostCommon(members.map(m => m.style || 'casual')) || 'casual';
    const colorFamily = mostCommon(members.map(m => m.colorFamily || null));
    // Kümenin merkezine en yakın parçalar örnek olarak gösterilir
    const centroid = members[0].embedding.map((_: number, d: number) => members.reduce((s, m) => s + m.embedding[d], 0) / members.length);
    const samples = [...members]
      .sort((a, b) => (cosine(b.embedding, centroid) ?? 0) - (cosine(a.embedding, centroid) ?? 0))
      .slice(0, 3)
      .map(m => ({ id: m.id, name: m.name || 'Parça', imagePath: m.cutoutImagePath || m.imagePath || '' }));
    clusters.push({
      label: `${STYLE_LABELS[style] || style}${colorFamily ? ` · ${colorFamily}` : ''}`,
      size: members.length,
      style,
      colorFamily,
      sampleItems: samples,
    });
  }
  return clusters.sort((a, b) => b.size - a.size);
}

function countBy(items: any[], key: (item: any) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) counts[key(item)] = (counts[key(item)] || 0) + 1;
  return counts;
}

export function computeWardrobeStats(items: any[], logs: { date: string; itemIds: string[] }[], today = localDate()): WardrobeStats {
  const wearable = items.filter(i => i.category !== 'makeup');
  const stats = wearable.map(toWornStat);
  const byWear = [...stats].sort((a, b) => b.wearCount - a.wearCount || a.name.localeCompare(b.name, 'tr'));
  const worn = byWear.filter(s => s.wearCount > 0);
  const never = stats.filter(s => s.wearCount === 0);
  const cutoff = addDays(today, -90);
  const stale = stats.filter(s => s.wearCount > 0 && s.lastWornAt && s.lastWornAt.slice(0, 10) < cutoff)
    .sort((a, b) => (a.lastWornAt! < b.lastWornAt! ? -1 : 1));
  const priced = stats.filter(s => s.price !== null);

  return {
    totalItems: items.length,
    totalWears: stats.reduce((sum, s) => sum + s.wearCount, 0),
    wearsLast30Days: logs.filter(l => daysBetween(l.date, today) >= 0 && daysBetween(l.date, today) < 30).length,
    mostWorn: worn.slice(0, 5),
    leastWorn: [...worn].reverse().slice(0, 5),
    neverWorn: never.slice(0, 12),
    neverWornCount: never.length,
    notWornIn90Days: stale.slice(0, 12),
    costPerWear: [...priced].sort((a, b) => (b.costPerWear ?? 0) - (a.costPerWear ?? 0)).slice(0, 10),
    wardrobeValue: priced.length ? Math.round(priced.reduce((sum, s) => sum + (s.price ?? 0), 0)) : null,
    styleClusters: styleClusters(items),
    embeddedItems: items.filter(i => Array.isArray(i.embedding) && i.embedding.length > 0).length,
    byCategory: countBy(items, i => i.category || 'top'),
    topColors: Object.entries(countBy(items.filter(i => i.color), i => String(i.color).trim().toLocaleLowerCase('tr-TR')))
      .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([color, count]) => ({ color, count })),
    topStyles: Object.entries(countBy(items.filter(i => i.style), i => i.style))
      .sort((a, b) => b[1] - a[1]).slice(0, 4).map(([style, count]) => ({ style, count })),
    aiAnalyzed: items.filter(i => i.aiAnalyzed).length,
    completeItems: items.filter(i => missingFields(i).length === 0).length,
  };
}
