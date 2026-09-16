import { ModelArtifactModel } from '../db.js';

/**
 * Kullanıcı geri bildirimlerinden öğrenilen uyum yeniden sıralayıcısı (lojistik regresyon).
 * Özellikler: puan bileşenleri + kombin yapısı (scoring.ts → outfitFeatures).
 * Eğitim: `npx tsx scripts/train-reranker.ts`. Yeterli veri yoksa model kaydedilmez ve motor onsuz çalışır.
 */
export interface RerankerModel {
  weights: number[];
  bias: number;
  featureCount: number;
  samples: number;
  positives: number;
  negatives: number;
  validationAuc: number;
}

export const RERANKER_NAME = 'outfit-reranker';
export const MIN_SAMPLES = 200;
export const MIN_PER_CLASS = 50;
export const MIN_VALIDATION_AUC = 0.6;

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export function predict(model: RerankerModel, features: number[]): number {
  let z = model.bias;
  for (let i = 0; i < model.featureCount; i++) z += (model.weights[i] || 0) * (features[i] || 0);
  return sigmoid(z);
}

export interface TrainingSample {
  features: number[];
  label: 0 | 1;
}

export function trainLogistic(samples: TrainingSample[], options: { epochs?: number; learningRate?: number; l2?: number } = {}): Omit<RerankerModel, 'samples' | 'positives' | 'negatives' | 'validationAuc'> {
  const featureCount = samples[0]?.features.length || 0;
  const weights = new Array(featureCount).fill(0);
  let bias = 0;
  const epochs = options.epochs ?? 300;
  const lr = options.learningRate ?? 0.3;
  const l2 = options.l2 ?? 0.01;

  for (let epoch = 0; epoch < epochs; epoch++) {
    const grad = new Array(featureCount).fill(0);
    let gradBias = 0;
    for (const s of samples) {
      const error = predict({ weights, bias, featureCount } as RerankerModel, s.features) - s.label;
      for (let i = 0; i < featureCount; i++) grad[i] += error * s.features[i];
      gradBias += error;
    }
    for (let i = 0; i < featureCount; i++) weights[i] -= lr * (grad[i] / samples.length + l2 * weights[i]);
    bias -= lr * (gradBias / samples.length);
  }
  return { weights, bias, featureCount };
}

/** ROC AUC (Mann–Whitney U ile). */
export function rocAuc(scores: number[], labels: number[]): number {
  const pairs = scores.map((s, i) => ({ s, l: labels[i] })).sort((a, b) => a.s - b.s);
  let rankSum = 0;
  let positives = 0;
  pairs.forEach((p, i) => { if (p.l === 1) { rankSum += i + 1; positives++; } });
  const negatives = pairs.length - positives;
  if (positives === 0 || negatives === 0) return 0.5;
  return (rankSum - positives * (positives + 1) / 2) / (positives * negatives);
}

let cache: { model: RerankerModel | null; loadedAt: number } | null = null;

/** Kayıtlı modeli yükler (10 dk önbellek). Model yoksa null döner. */
export async function loadReranker(): Promise<((features: number[]) => number) | null> {
  if (!cache || Date.now() - cache.loadedAt > 10 * 60 * 1000) {
    try {
      const doc: any = await ModelArtifactModel.findOne({ name: RERANKER_NAME } as any).lean();
      cache = { model: doc?.payload || null, loadedAt: Date.now() };
    } catch {
      cache = { model: null, loadedAt: Date.now() };
    }
  }
  const model = cache.model;
  if (!model || !Array.isArray(model.weights)) return null;
  return (features: number[]) => (features.length === model.featureCount ? predict(model, features) : 0.5);
}

export function resetRerankerCacheForTests() {
  cache = null;
}
