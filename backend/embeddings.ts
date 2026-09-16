import { CATEGORY_LABELS, STYLE_LABELS, FORMALITY_LABELS, WARMTH_LABELS } from '../shared/wardrobe.js';
import { embed, cosine } from './ai/gemini.js';
import { EMBEDDING_MODEL } from './ai/models.js';
import { downloadOwnImage, withTransformation } from './cloudinary.js';

/** Parçanın embedding'e girecek metin tarifi (görselle birlikte tek vektöre dönüşür). */
export function itemEmbeddingText(item: any): string {
  const parts = [
    `Kategori: ${CATEGORY_LABELS[item.category] || item.category || ''}`,
    item.subCategory && `Tür: ${item.subCategory}`,
    item.color && `Renk: ${item.color}`,
    item.colorFamily && `Renk ailesi: ${item.colorFamily}`,
    item.material && `Kumaş: ${item.material}`,
    item.pattern && `Desen: ${item.pattern}`,
    item.fit && `Kesim: ${item.fit}`,
    item.style && `Stil: ${STYLE_LABELS[item.style] || item.style}`,
    item.formality && `Resmiyet: ${FORMALITY_LABELS[item.formality] || item.formality}`,
    item.warmth && `Sıcak tutma: ${WARMTH_LABELS[item.warmth] || item.warmth}`,
  ];
  return parts.filter(Boolean).join('. ');
}

/**
 * Parçanın görsel + metin embedding'ini hesaplar. Görsel verilmezse Cloudinary'den küçük bir kopyası indirilir.
 * Başarısız olursa null döner (öneri motoru embedding olmadan da çalışır).
 */
export async function computeItemEmbedding(item: any, image?: { base64: string; mimeType: string } | null): Promise<number[] | null> {
  let source = image || null;
  if (!source && item.imagePath) {
    const downloaded = await downloadOwnImage(withTransformation(item.imagePath, 'f_jpg,q_auto,w_512'));
    source = downloaded ? { base64: downloaded.base64, mimeType: downloaded.mimeType } : null;
  }
  return embed({ text: itemEmbeddingText(item), image: source || undefined }, 'item_embedding');
}

/** Belgeye embedding alanlarını yazar (kaydetmez). */
export function applyEmbedding(doc: any, vector: number[] | null) {
  if (!vector) return;
  doc.embedding = vector;
  doc.embeddingModel = EMBEDDING_MODEL;
}

export interface SimilarItem {
  item: any;
  similarity: number;
}

/** Aynı kategoride görsel olarak çok benzeyen parçaları bulur (aynı parçayı ikinci kez ekleme uyarısı). */
export function findSimilarItems(vector: number[] | null, candidates: any[], options: { category?: string; excludeId?: string; threshold?: number; limit?: number } = {}): SimilarItem[] {
  if (!vector) return [];
  const threshold = options.threshold ?? 0.9;
  return candidates
    .filter(c => c.embedding?.length && c.id !== options.excludeId && (!options.category || c.category === options.category))
    .map(c => ({ item: c, similarity: cosine(vector, c.embedding) ?? 0 }))
    .filter(s => s.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, options.limit ?? 3);
}

/** Basit k-means (kosinüs benzerliği ile); istatistik ekranındaki stil kümeleri için. */
export function kmeans(vectors: number[][], k: number, iterations = 15): number[] {
  const n = vectors.length;
  if (n === 0 || k <= 0) return [];
  const clusters = Math.min(k, n);
  // Deterministik başlangıç: birbirinden en uzak noktaları seç
  const centroids: number[][] = [vectors[0]];
  while (centroids.length < clusters) {
    let bestIndex = 0;
    let bestDistance = -1;
    for (let i = 0; i < n; i++) {
      const nearest = Math.max(...centroids.map(c => cosine(vectors[i], c) ?? -1));
      const distance = 1 - nearest;
      if (distance > bestDistance) { bestDistance = distance; bestIndex = i; }
    }
    centroids.push(vectors[bestIndex]);
  }

  let assignment = new Array(n).fill(0);
  for (let iter = 0; iter < iterations; iter++) {
    const next = vectors.map(v => {
      let best = 0;
      let bestSim = -Infinity;
      centroids.forEach((c, idx) => {
        const sim = cosine(v, c) ?? -1;
        if (sim > bestSim) { bestSim = sim; best = idx; }
      });
      return best;
    });
    const changed = next.some((c, i) => c !== assignment[i]);
    assignment = next;
    for (let c = 0; c < clusters; c++) {
      const members = vectors.filter((_, i) => assignment[i] === c);
      if (members.length === 0) continue;
      const sum = new Array(members[0].length).fill(0);
      for (const m of members) for (let d = 0; d < m.length; d++) sum[d] += m[d];
      const norm = Math.sqrt(sum.reduce((s, v) => s + v * v, 0)) || 1;
      centroids[c] = sum.map(v => v / norm);
    }
    if (!changed && iter > 0) break;
  }
  return assignment;
}
