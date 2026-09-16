import { FEEDBACK_TYPES, FeedbackType, ContextSummary, TempBand } from '../shared/api.js';
import { FEEDBACK_REASONS, FeedbackReason } from '../shared/wardrobe.js';
import { RequestError } from './engine/request.js';
import { recordFeedback } from './preferences.js';
import { recordWear } from './wearLog.js';
import { localDate } from './time.js';

export interface CleanFeedback {
  type: FeedbackType;
  generationId?: string;
  itemIds: string[];
  itemId?: string;
  reason?: FeedbackReason;
  note?: string;
  context?: ContextSummary;
}

const ID_PATTERN = /^[\w.:-]{1,100}$/;
const TEMP_BANDS: TempBand[] = ['freezing', 'cold', 'cool', 'mild', 'warm', 'hot'];
const OUTERWEAR = ['required', 'recommended', 'optional', 'avoid'];
const PRECIPITATION = ['none', 'rain', 'snow'];

const inRange = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

/** Bağlam özetini yalnızca bilinen alanlarla ve sınırlar içinde kabul eder; aksi halde yok sayar. */
export function sanitizeContextSummary(raw: unknown): ContextSummary | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.event !== 'string' || !inRange(r.formalityMin, 1, 5) || !inRange(r.formalityMax, 1, 5)
    || !inRange(r.formalityTarget, 1, 5) || !inRange(r.activity, 1, 5)) return undefined;
  return {
    event: r.event.slice(0, 60),
    formalityMin: r.formalityMin as number,
    formalityMax: r.formalityMax as number,
    formalityTarget: r.formalityTarget as number,
    activity: r.activity as number,
    tempBand: TEMP_BANDS.includes(r.tempBand as TempBand) ? r.tempBand as TempBand : null,
    precipitation: PRECIPITATION.includes(r.precipitation as string) ? r.precipitation as ContextSummary['precipitation'] : 'none',
    outerwear: OUTERWEAR.includes(r.outerwear as string) ? r.outerwear as ContextSummary['outerwear'] : 'optional',
    needsWaterResistant: r.needsWaterResistant === true,
    season: typeof r.season === 'string' ? r.season.slice(0, 20) : '',
    feelsLikeC: inRange(r.feelsLikeC, -60, 60) ? r.feelsLikeC as number : null,
    indoor: r.indoor === true,
  };
}

/** /api/feedback gövdesini doğrular. Sunucunun kendi yazdığı "shown" türü istemciden kabul edilmez. */
export function sanitizeFeedback(raw: unknown): CleanFeedback {
  if (!raw || typeof raw !== 'object') throw new RequestError('Geri bildirim eksik.');
  const r = raw as Record<string, unknown>;

  if (!FEEDBACK_TYPES.includes(r.type as FeedbackType)) throw new RequestError('Geçersiz geri bildirim türü.');
  const type = r.type as FeedbackType;

  if (r.itemIds !== undefined && !Array.isArray(r.itemIds)) throw new RequestError('itemIds bir liste olmalı.');
  const rawIds = (r.itemIds as unknown[] | undefined) || [];
  if (rawIds.length > 12 || rawIds.some(id => typeof id !== 'string' || !ID_PATTERN.test(id))) {
    throw new RequestError('Geçersiz parça listesi.');
  }
  const itemIds = Array.from(new Set(rawIds as string[]));

  let itemId: string | undefined;
  if (r.itemId !== undefined && r.itemId !== null) {
    if (typeof r.itemId !== 'string' || !ID_PATTERN.test(r.itemId)) throw new RequestError('Geçersiz parça kimliği.');
    itemId = r.itemId;
  }

  if (type === 'replaced' && !itemId) throw new RequestError('Değiştirilen parça belirtilmeli.');
  if (type !== 'replaced' && type !== 'rerolled' && itemIds.length === 0) throw new RequestError('Kombin parçaları belirtilmeli.');

  let reason: FeedbackReason | undefined;
  if (r.reason !== undefined && r.reason !== null && r.reason !== '') {
    if (!FEEDBACK_REASONS.some(x => x.value === r.reason)) throw new RequestError('Geçersiz geri bildirim nedeni.');
    reason = r.reason as FeedbackReason;
  }

  let generationId: string | undefined;
  if (r.generationId !== undefined && r.generationId !== null) {
    if (typeof r.generationId !== 'string' || !ID_PATTERN.test(r.generationId)) throw new RequestError('Geçersiz öneri kimliği.');
    generationId = r.generationId;
  }

  const note = typeof r.note === 'string' && r.note.trim() ? r.note.trim().slice(0, 300) : undefined;

  return { type, generationId, itemIds, itemId, reason, note, context: sanitizeContextSummary(r.context) };
}

export interface FeedbackOutcome {
  stored: boolean;
  wearLogId: string | null;
}

/**
 * Geri bildirimi işler:
 * - "worn": giyim günlüğüne (bugünün Türkiye tarihi) yazılır; bu kullanıcının açık eylemidir, rızadan bağımsızdır.
 * - Tüm türler: kişiselleştirme rızası varsa olay kaydedilir ve tercih profili güncellenir; yoksa hiçbir şey saklanmaz.
 */
export async function handleFeedback(user: any, feedback: CleanFeedback): Promise<FeedbackOutcome> {
  let wearLogId: string | null = null;
  if (feedback.type === 'worn') {
    const log = await recordWear(user._id, {
      date: localDate(),
      itemIds: feedback.itemIds,
      outfitId: feedback.generationId,
      source: 'suggestion',
    });
    wearLogId = log.id;
  }
  const { stored } = await recordFeedback(user, feedback);
  return { stored, wearLogId };
}
