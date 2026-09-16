import { contextFromSummary } from './context.js';
import type { EngineItem } from './items.js';
import { outfitFeatures, scoreOutfit } from './scoring.js';
import { predict, rocAuc, trainLogistic, TrainingSample, RerankerModel, MIN_SAMPLES, MIN_PER_CLASS, MIN_VALIDATION_AUC } from './reranker.js';

export const POSITIVE_TYPES = new Set(['saved', 'worn', 'liked']);
export const NEGATIVE_TYPES = new Set(['disliked']);

export interface FeedbackRecord {
  userId: string;
  type: string;
  generationId?: string | null;
  itemIds: string[];
  context?: any;
  createdAt: Date | string;
}

const outfitKey = (userId: string, ids: string[]) => `${userId}:${[...ids].sort().join('|')}`;

/**
 * Geri bildirim olaylarından etiketli örnekler üretir:
 * - Pozitif: kaydedilen, giyilen, beğenilen kombin.
 * - Negatif: beğenilmeyen kombin; ayrıca "Yenile" ile geçilen öneri turunda gösterilip hiçbir olumlu etkileşim almamış kombinler.
 * Aynı kullanıcı + aynı kombin için son etiket geçerlidir. Özellikler, olay anındaki bağlamla yeniden puanlanarak çıkarılır
 * (kişisel tercih bileşeni sızıntı olmaması için hesaba katılmaz).
 */
export function buildTrainingSamples(events: FeedbackRecord[], itemsByUser: Map<string, Map<string, EngineItem>>): TrainingSample[] {
  const sorted = [...events].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const rerolled = new Set(sorted.filter(e => e.type === 'rerolled' && e.generationId).map(e => `${e.userId}:${e.generationId}`));
  const positiveKeys = new Set(sorted.filter(e => POSITIVE_TYPES.has(e.type)).map(e => outfitKey(e.userId, e.itemIds)));

  const labeled = new Map<string, { record: FeedbackRecord; label: 0 | 1 }>();
  for (const e of sorted) {
    if (!e.itemIds || e.itemIds.length < 2) continue;
    const key = outfitKey(e.userId, e.itemIds);
    if (POSITIVE_TYPES.has(e.type)) labeled.set(key, { record: e, label: 1 });
    else if (NEGATIVE_TYPES.has(e.type)) labeled.set(key, { record: e, label: 0 });
    else if (e.type === 'shown' && e.generationId && rerolled.has(`${e.userId}:${e.generationId}`) && !positiveKeys.has(key) && !labeled.has(key)) {
      labeled.set(key, { record: e, label: 0 });
    }
  }

  const samples: TrainingSample[] = [];
  for (const { record, label } of labeled.values()) {
    const items = itemsByUser.get(record.userId);
    if (!items) continue;
    const outfitItems = record.itemIds.map(id => items.get(id)).filter(Boolean) as EngineItem[];
    if (outfitItems.length !== record.itemIds.length) continue; // silinmiş parça
    const ctx = contextFromSummary(record.context);
    const breakdown = scoreOutfit(outfitItems, ctx, {});
    samples.push({ features: outfitFeatures(breakdown, outfitItems), label });
  }
  return samples;
}

/** Deterministik karıştırma (tekrar üretilebilir eğitim için). */
function shuffle<T>(values: T[], seed = 42): T[] {
  const out = [...values];
  let state = seed;
  const random = () => { state = (state * 1664525 + 1013904223) % 4294967296; return state / 4294967296; };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export type TrainOutcome =
  | { ok: true; model: RerankerModel }
  | { ok: false; reason: string; samples: number; positives: number; negatives: number; validationAuc?: number };

/** %80 eğitim / %20 doğrulama. Yeterli veri veya doğrulama başarısı yoksa model üretmez. */
export function trainReranker(samples: TrainingSample[]): TrainOutcome {
  const positives = samples.filter(s => s.label === 1).length;
  const negatives = samples.length - positives;
  if (samples.length < MIN_SAMPLES || positives < MIN_PER_CLASS || negatives < MIN_PER_CLASS) {
    return { ok: false, reason: `Yetersiz veri (en az ${MIN_SAMPLES} örnek ve sınıf başına ${MIN_PER_CLASS} gerekli)`, samples: samples.length, positives, negatives };
  }
  const shuffled = shuffle(samples);
  const cut = Math.floor(shuffled.length * 0.8);
  const train = shuffled.slice(0, cut);
  const validation = shuffled.slice(cut);
  const trained = trainLogistic(train);
  const auc = rocAuc(validation.map(s => predict(trained as RerankerModel, s.features)), validation.map(s => s.label));
  if (auc < MIN_VALIDATION_AUC) {
    return { ok: false, reason: `Doğrulama AUC ${auc.toFixed(3)} < ${MIN_VALIDATION_AUC}`, samples: samples.length, positives, negatives, validationAuc: auc };
  }
  // Son model tüm veriyle eğitilir
  const full = trainLogistic(shuffled);
  return { ok: true, model: { ...full, samples: samples.length, positives, negatives, validationAuc: auc } };
}
