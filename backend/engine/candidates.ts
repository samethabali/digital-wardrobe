import type { Category } from '../../shared/wardrobe.js';
import type { EngineItem } from './items.js';
import type { StyleContext } from './context.js';
import type { PreferenceData, ScoringDeps } from './scoring.js';

export interface ScoredItem {
  item: EngineItem;
  score: number;
  /** Sert filtreye takıldıysa nedeni (zorunlu parçalar yine de aday listesinde kalır) */
  excludedReason: string | null;
}

export type CandidatePool = Record<Category, ScoredItem[]>;

export const DEFAULT_K: Record<Category, number> = {
  top: 8, bottom: 8, onepiece: 6, outerwear: 6, shoes: 6, accessory: 4, makeup: 3,
};

const clamp = (v: number) => Math.min(100, Math.max(0, v));

/** Parçanın tek başına bu bağlama uygunluğu ve varsa sert eleme nedeni. */
export function itemFit(item: EngineItem, ctx: StyleContext, prefs?: PreferenceData | null, deps?: ScoringDeps): ScoredItem {
  let score = 100;
  let excludedReason: string | null = null;
  const { min, max } = ctx.formality;

  if (item.category !== 'makeup') {
    const distance = item.formality < min ? min - item.formality : item.formality > max ? item.formality - max : 0;
    score -= 20 * distance;
    if (distance >= 2) excludedReason = 'resmiyet';
  }

  if (ctx.activity >= 4 && item.formality >= 4 && item.category !== 'accessory') {
    score -= 30;
    excludedReason = excludedReason || 'hareket';
  }

  const band = ctx.tempBand;
  if (band) {
    const coldBand = band === 'cold' || band === 'freezing';
    switch (item.category) {
      case 'top':
      case 'onepiece':
        if (band === 'hot' && item.warmth >= 4) { score -= 35; excludedReason = excludedReason || 'hava'; }
        if (band === 'warm' && item.warmth >= 4) score -= 20;
        if (band === 'freezing' && item.warmth <= 1 && item.category === 'onepiece') score -= 25;
        if (coldBand && item.warmth <= 1) score -= 10;
        break;
      case 'bottom':
        if (band === 'hot' && item.warmth >= 4) score -= 20;
        if (coldBand && item.warmth <= 1) { score -= 35; excludedReason = excludedReason || 'hava'; }
        break;
      case 'outerwear':
        if (band === 'hot' && item.warmth >= 3) { score -= 40; excludedReason = excludedReason || 'hava'; }
        if (band === 'warm' && item.warmth >= 4) { score -= 30; excludedReason = excludedReason || 'hava'; }
        if (ctx.minOuterWarmth && item.warmth < ctx.minOuterWarmth) score -= 15 * (ctx.minOuterWarmth - item.warmth);
        if (ctx.needsWaterResistant && !item.waterResistant) score -= 12;
        break;
      case 'accessory':
        // Atkı, bere gibi kalın aksesuarlar sıcak havaya uymaz
        if ((band === 'warm' || band === 'hot') && item.warmth >= 4) { score -= 40; excludedReason = excludedReason || 'hava'; }
        break;
      case 'shoes':
        if (coldBand && item.warmth <= 1) { score -= 40; excludedReason = excludedReason || 'hava'; }
        if (band === 'hot' && item.warmth >= 4) score -= 20;
        if (ctx.precipitation === 'rain' && !item.waterResistant) score -= 10;
        if (ctx.precipitation === 'snow' && (!item.waterResistant || item.warmth <= 2)) score -= 25;
        break;
    }
  }

  if (item.seasons.length && !item.seasons.includes(ctx.season) && item.category !== 'accessory' && item.category !== 'makeup') {
    score -= 8;
  }

  const aff = prefs?.affinities;
  if (aff) {
    const value = (aff.item[item.id] ?? 0) + 0.5 * (item.colorFamily ? aff.colorFamily[item.colorFamily] ?? 0 : 0) + 0.5 * (aff.style[item.style] ?? 0);
    score += 12 * Math.tanh(value / 4);
  }
  if (prefs?.dislikedColorFamilies.length && item.colorFamily && prefs.dislikedColorFamilies.includes(item.colorFamily)) {
    score -= 20;
  }

  const days = deps?.recentlyWorn?.get(item.id);
  if (days !== undefined && days <= 2 && !deps?.protectedIds?.has(item.id)) score -= 15;

  return { item, score: clamp(score), excludedReason };
}

export interface CandidateOptions {
  required: Set<string>;
  excluded: Set<string>;
  k?: Partial<Record<Category, number>>;
  prefs?: PreferenceData | null;
  deps?: ScoringDeps;
}

export interface CandidateResult {
  pool: CandidatePool;
  warnings: string[];
}

const CATEGORY_NAMES: Record<Category, string> = {
  top: 'üst giyim', bottom: 'alt giyim', onepiece: 'tek parça', outerwear: 'dış giyim',
  shoes: 'ayakkabı', accessory: 'aksesuar', makeup: 'makyaj',
};

/**
 * Her kategori için en uygun K parçayı seçer. Sert filtreler bir kategoriyi tamamen boşaltırsa
 * filtre o kategori için gevşetilir ve kullanıcıya uyarı verilir.
 */
export function selectCandidates(items: EngineItem[], ctx: StyleContext, options: CandidateOptions): CandidateResult {
  const warnings: string[] = [];
  const pool = { top: [], bottom: [], onepiece: [], outerwear: [], shoes: [], accessory: [], makeup: [] } as CandidatePool;
  const k = { ...DEFAULT_K, ...(options.k || {}) };

  const byCategory = new Map<Category, ScoredItem[]>();
  for (const item of items) {
    if (options.excluded.has(item.id) && !options.required.has(item.id)) continue;
    const scored = itemFit(item, ctx, options.prefs, options.deps);
    const list = byCategory.get(item.category) || [];
    list.push(scored);
    byCategory.set(item.category, list);
  }

  for (const [category, list] of byCategory) {
    const required = list.filter(s => options.required.has(s.item.id));
    const allowed = list.filter(s => !options.required.has(s.item.id) && !s.excludedReason);
    const blocked = list.filter(s => !options.required.has(s.item.id) && s.excludedReason);

    let chosen = allowed.sort((a, b) => b.score - a.score).slice(0, k[category]);
    const structural = ['top', 'bottom', 'shoes', 'onepiece'].includes(category) || (category === 'outerwear' && ctx.outerwear === 'required');
    if (chosen.length === 0 && blocked.length > 0 && required.length === 0 && structural) {
      chosen = blocked.sort((a, b) => b.score - a.score).slice(0, k[category]);
      warnings.push(`Bu etkinlik ve havaya tam uyan ${CATEGORY_NAMES[category]} bulunamadı; en yakın seçenekler kullanıldı.`);
    }
    for (const r of required) {
      if (r.excludedReason === 'hava') warnings.push(`Zorunlu seçtiğin "${r.item.name}" bu hava için ideal değil.`);
      if (r.excludedReason === 'resmiyet') warnings.push(`Zorunlu seçtiğin "${r.item.name}" etkinliğin resmiyetiyle tam uyuşmuyor.`);
    }
    pool[category] = [...required, ...chosen];
  }

  return { pool, warnings };
}
