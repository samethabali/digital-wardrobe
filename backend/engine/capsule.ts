import {
  CATEGORIES, CATEGORY_LABELS, COLOR_FAMILIES, FITS, LAYER_ROLES, PATTERNS, SEASONS, STYLES, UNKNOWN,
} from '../../shared/wardrobe.js';
import { generateJson } from '../ai/gemini.js';
import { EngineItem, toEngineItem } from './items.js';
import { buildContext, StyleContext } from './context.js';
import { colorScore, silhouetteScore, styleScore } from './scoring.js';

export const CAPSULE_TARGETS = ['any', 'top', 'bottom', 'onepiece', 'outerwear', 'shoes', 'accessory'] as const;
export type CapsuleTarget = typeof CAPSULE_TARGETS[number];

const SAMPLE_LIMIT = 60_000;
const neutralContext = (): StyleContext => buildContext({ event: 'Gündelik', ignoreWeather: true, weather: null });

/**
 * "Giyilebilir" kombin: renk, stil ve silüet uyumu eşiği geçen ve resmiyet farkı en fazla 2 olan kombin.
 * Etkinlik ve hava dikkate alınmaz; gardırobun genel kombin potansiyelini ölçer.
 */
export function isWearable(items: EngineItem[], ctx: StyleContext): boolean {
  const main = items.filter(i => i.category !== 'accessory' && i.category !== 'makeup');
  const formalities = main.map(i => i.formality);
  if (Math.max(...formalities) - Math.min(...formalities) > 2) return false;
  return colorScore(items, ctx) >= 65 && styleScore(items, ctx) >= 60 && silhouetteScore(items, ctx) >= 60;
}

// Tekrarlanabilir örnekleme için basit sözde rastgele üreteç
function lcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export interface OutfitCount {
  count: number;
  total: number;
  estimated: boolean;
}

/** Üst+alt+ayakkabı ve tek parça+ayakkabı kombinlerinden giyilebilir olanları sayar (çok büyükse örnekleyerek tahmin eder). */
export function countWearableOutfits(items: EngineItem[], extraFilter?: (combo: EngineItem[]) => boolean): OutfitCount {
  const ctx = neutralContext();
  const tops = items.filter(i => i.category === 'top');
  const bottoms = items.filter(i => i.category === 'bottom');
  const pieces = items.filter(i => i.category === 'onepiece');
  const shoes = items.filter(i => i.category === 'shoes');
  const separates = tops.length * bottoms.length * shoes.length;
  const onepieceCombos = pieces.length * shoes.length;
  const total = separates + onepieceCombos;
  if (total === 0) return { count: 0, total: 0, estimated: false };

  const check = (combo: EngineItem[]) => (!extraFilter || extraFilter(combo)) && isWearable(combo, ctx);

  if (total <= SAMPLE_LIMIT) {
    let count = 0;
    for (const shoe of shoes) {
      for (const top of tops) for (const bottom of bottoms) if (check([top, bottom, shoe])) count++;
      for (const piece of pieces) if (check([piece, shoe])) count++;
    }
    return { count, total, estimated: false };
  }

  const random = lcg(items.length * 7919 + total);
  let hits = 0;
  for (let n = 0; n < SAMPLE_LIMIT; n++) {
    const shoe = shoes[Math.floor(random() * shoes.length)];
    const useSeparate = random() * total < separates;
    const combo = useSeparate
      ? [tops[Math.floor(random() * tops.length)], bottoms[Math.floor(random() * bottoms.length)], shoe]
      : [pieces[Math.floor(random() * pieces.length)], shoe];
    if (check(combo)) hits++;
  }
  return { count: Math.round((hits / SAMPLE_LIMIT) * total), total, estimated: true };
}

/**
 * Yeni bir parçanın katkısı: ana kategorilerde eklediği yeni giyilebilir kombin sayısı,
 * dış giyim/aksesuarda ise uyumlu olduğu mevcut kombin sayısı.
 */
export function contributionOf(candidate: EngineItem, items: EngineItem[]): number {
  const ctx = neutralContext();
  const tops = items.filter(i => i.category === 'top');
  const bottoms = items.filter(i => i.category === 'bottom');
  const pieces = items.filter(i => i.category === 'onepiece');
  const shoes = items.filter(i => i.category === 'shoes');

  // Ana kategorilerde yalnızca adayın yer aldığı kombinler sayılır
  if (candidate.category === 'top') {
    let count = 0;
    for (const bottom of bottoms) for (const shoe of shoes) if (isWearable([candidate, bottom, shoe], ctx)) count++;
    return count;
  }
  if (candidate.category === 'bottom') {
    let count = 0;
    for (const top of tops) for (const shoe of shoes) if (isWearable([top, candidate, shoe], ctx)) count++;
    return count;
  }
  if (candidate.category === 'onepiece') {
    return shoes.filter(shoe => isWearable([candidate, shoe], ctx)).length;
  }
  if (candidate.category === 'shoes') {
    let count = 0;
    for (const top of tops) for (const bottom of bottoms) if (isWearable([top, bottom, candidate], ctx)) count++;
    for (const piece of pieces) if (isWearable([piece, candidate], ctx)) count++;
    return count;
  }

  let pairs = 0;
  let checked = 0;
  outer: for (const shoe of shoes) {
    for (const top of tops) {
      for (const bottom of bottoms) {
        if (checked++ > 20_000) break outer;
        const base = [top, bottom, shoe];
        if (isWearable(base, ctx) && isWearable([...base, candidate], ctx) && Math.abs(candidate.formality - top.formality) <= 2) pairs++;
      }
    }
  }
  return pairs;
}

export interface CapsuleSuggestion {
  name: string;
  category: string;
  subCategory: string;
  colorFamily: string;
  colorHex: string | null;
  material: string;
  pattern: string;
  fit: string;
  style: string;
  formality: number;
  warmth: number;
  reason: string;
  gain: number;
  gainType: 'new_outfits' | 'pairings';
}

export interface CapsuleResult {
  insufficient: boolean;
  message?: string;
  currentOutfitCount: number;
  estimated: boolean;
  suggestions: CapsuleSuggestion[];
  model: string | null;
  usedFallback: boolean;
  // Eski istemci uyumluluğu
  projectedOutfitCount?: number;
  suggestedItem?: { name: string; category: string; reason: string };
}

function summarize(items: EngineItem[]) {
  const countBy = (key: (i: EngineItem) => string) => items.reduce<Record<string, number>>((acc, item) => {
    const k = key(item);
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  return {
    kategoriler: countBy(i => i.category),
    renkAileleri: countBy(i => i.colorFamily || UNKNOWN),
    stiller: countBy(i => i.style),
    resmiyet: countBy(i => String(i.formality)),
    sicakTutma: countBy(i => String(i.warmth)),
    mevsimler: countBy(i => i.seasons.join('/')),
    mevcutTurler: Array.from(new Set(items.map(i => `${i.category}: ${i.colorFamily || ''} ${i.subCategory}`))).slice(0, 120),
  };
}

// LLM kullanılamazsa denenecek çok yönlü temel parçalar
const STAPLES: Array<Partial<CapsuleSuggestion> & { category: string }> = [
  { name: 'Beyaz basic tişört', category: 'top', subCategory: 'tişört', colorFamily: 'beyaz', material: 'pamuk', pattern: 'düz', fit: 'normal', style: 'casual', formality: 2, warmth: 2 },
  { name: 'Açık mavi gömlek', category: 'top', subCategory: 'gömlek', colorFamily: 'mavi', material: 'pamuk', pattern: 'düz', fit: 'normal', style: 'smart-casual', formality: 4, warmth: 3 },
  { name: 'Lacivert ince triko', category: 'top', subCategory: 'triko', colorFamily: 'lacivert', material: 'yün', pattern: 'düz', fit: 'normal', style: 'smart-casual', formality: 3, warmth: 3 },
  { name: 'Koyu mavi düz paça jean', category: 'bottom', subCategory: 'jean', colorFamily: 'lacivert', material: 'denim', pattern: 'düz', fit: 'normal', style: 'casual', formality: 2, warmth: 3 },
  { name: 'Bej chino pantolon', category: 'bottom', subCategory: 'chino pantolon', colorFamily: 'bej', material: 'pamuk', pattern: 'düz', fit: 'normal', style: 'smart-casual', formality: 3, warmth: 3 },
  { name: 'Siyah kumaş pantolon', category: 'bottom', subCategory: 'kumaş pantolon', colorFamily: 'siyah', material: 'yün karışım', pattern: 'düz', fit: 'normal', style: 'classic', formality: 4, warmth: 3 },
  { name: 'Siyah midi elbise', category: 'onepiece', subCategory: 'elbise', colorFamily: 'siyah', material: 'krep', pattern: 'düz', fit: 'normal', style: 'elegant', formality: 4, warmth: 2 },
  { name: 'Beyaz deri sneaker', category: 'shoes', subCategory: 'sneaker', colorFamily: 'beyaz', material: 'deri', pattern: UNKNOWN, fit: UNKNOWN, style: 'casual', formality: 2, warmth: 2 },
  { name: 'Kahverengi deri loafer', category: 'shoes', subCategory: 'loafer', colorFamily: 'kahverengi', material: 'deri', pattern: UNKNOWN, fit: UNKNOWN, style: 'classic', formality: 4, warmth: 2 },
  { name: 'Siyah deri bot', category: 'shoes', subCategory: 'bot', colorFamily: 'siyah', material: 'deri', pattern: UNKNOWN, fit: UNKNOWN, style: 'casual', formality: 3, warmth: 4 },
  { name: 'Lacivert blazer', category: 'outerwear', subCategory: 'blazer', colorFamily: 'lacivert', material: 'yün karışım', pattern: 'düz', fit: 'normal', style: 'smart-casual', formality: 4, warmth: 2 },
  { name: 'Bej trençkot', category: 'outerwear', subCategory: 'trençkot', colorFamily: 'bej', material: 'gabardin', pattern: 'düz', fit: 'normal', style: 'classic', formality: 4, warmth: 3 },
  { name: 'Kahverengi deri kemer', category: 'accessory', subCategory: 'kemer', colorFamily: 'kahverengi', material: 'deri', pattern: UNKNOWN, fit: UNKNOWN, style: 'classic', formality: 3, warmth: 1 },
];

function virtualItem(s: Partial<CapsuleSuggestion>, index: number): EngineItem {
  return toEngineItem({
    id: `__virtual_${index}`,
    name: s.name,
    category: s.category,
    subCategory: s.subCategory,
    colorFamily: s.colorFamily,
    colorHex: s.colorHex,
    material: s.material,
    pattern: s.pattern,
    fit: s.fit,
    style: s.style,
    formality: s.formality,
    warmth: s.warmth,
  });
}

function suggestionSchema(target: CapsuleTarget) {
  return {
    type: 'object',
    properties: {
      suggestions: {
        type: 'array',
        minItems: 1,
        maxItems: 4,
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            category: { type: 'string', enum: target === 'any' ? CATEGORIES.filter(c => c !== 'makeup') : [target] },
            subCategory: { type: 'string' },
            colorFamily: { type: 'string', enum: [...COLOR_FAMILIES] },
            colorHex: { type: 'string' },
            material: { type: 'string' },
            pattern: { type: 'string', enum: [...PATTERNS] },
            fit: { type: 'string', enum: [...FITS] },
            style: { type: 'string', enum: [...STYLES] },
            formality: { type: 'integer', minimum: 1, maximum: 5 },
            warmth: { type: 'integer', minimum: 1, maximum: 5 },
            layerRole: { type: 'string', enum: [...LAYER_ROLES] },
            seasons: { type: 'array', items: { type: 'string', enum: [...SEASONS] } },
            reason: { type: 'string' },
          },
          required: ['name', 'category', 'subCategory', 'colorFamily', 'colorHex', 'material', 'pattern', 'fit', 'style', 'formality', 'warmth', 'layerRole', 'seasons', 'reason'],
        },
      },
    },
    required: ['suggestions'],
  };
}

/** Kapsül analizi: sayılar kodla hesaplanır, LLM yalnızca eksik parça adayı önerir. */
export async function analyzeCapsule(docs: any[], target: CapsuleTarget): Promise<CapsuleResult> {
  const items = docs.map(toEngineItem).filter(i => i.category !== 'makeup');
  if (items.length < 5) {
    return {
      insufficient: true,
      message: 'Kapsül gardırop analizi için dolabında en az 5 parça olmalı.',
      currentOutfitCount: 0, estimated: false, suggestions: [], model: null, usedFallback: false,
    };
  }

  const current = countWearableOutfits(items);
  let model: string | null = null;
  let usedFallback = false;
  let raw: Array<Partial<CapsuleSuggestion> & { category: string }> = [];

  try {
    const targetText = target === 'any' ? 'herhangi bir kategoriden' : `yalnızca "${CATEGORY_LABELS[target]}" kategorisinden`;
    const { data, info } = await generateJson<{ suggestions: any[] }>({
      task: 'stylist',
      label: 'capsule_suggest',
      systemInstruction: 'Sen kapsül gardırop uzmanı bir stilistsin. Kullanıcının gardırobundaki boşlukları bulur, mevcut parçalarla en çok kombin kurabilecek çok yönlü parçaları önerirsin. Türkçe yazarsın.',
      contents: `GARDIROP ÖZETİ (JSON):\n${JSON.stringify(summarize(items))}\n\n${targetText} gardıroba eklendiğinde mevcut parçalarla en çok yeni kombin kurulmasını sağlayacak 3-4 farklı parça öner. Gardıropta zaten benzeri olan parçaları önerme. reason alanında hangi mevcut parçalarla nasıl kombinleneceğini 2 cümleyle açıkla.`,
      schema: suggestionSchema(target),
    });
    model = info.model;
    raw = (data?.suggestions || []).filter(s => s && typeof s.name === 'string' && (target === 'any' || s.category === target));
  } catch {
    usedFallback = true;
  }
  if (raw.length === 0) {
    usedFallback = true;
    raw = STAPLES.filter(s => target === 'any' || s.category === target);
  }

  const evaluated = raw.slice(0, 13).map((s, index) => {
    const item = virtualItem(s, index);
    const gain = contributionOf(item, items);
    const gainType: CapsuleSuggestion['gainType'] = ['top', 'bottom', 'onepiece', 'shoes'].includes(item.category) ? 'new_outfits' : 'pairings';
    const reason = s.reason || (gainType === 'new_outfits'
      ? `Mevcut parçalarınla ${gain} yeni giyilebilir kombin oluşturuyor.`
      : `Mevcut ${gain} kombininle uyumlu bir tamamlayıcı parça.`);
    return {
      name: String(s.name).slice(0, 80),
      category: item.category,
      subCategory: item.subCategory,
      colorFamily: item.colorFamily || UNKNOWN,
      colorHex: item.colorHex,
      material: item.material,
      pattern: item.pattern,
      fit: item.fit,
      style: item.style,
      formality: item.formality,
      warmth: item.warmth,
      reason: String(reason).slice(0, 400),
      gain,
      gainType,
    };
  }).filter(s => s.gain > 0).sort((a, b) => b.gain - a.gain).slice(0, 3);

  const best = evaluated[0];
  return {
    insufficient: false,
    currentOutfitCount: current.count,
    estimated: current.estimated,
    suggestions: evaluated,
    model,
    usedFallback,
    projectedOutfitCount: best ? current.count + (best.gainType === 'new_outfits' ? best.gain : 0) : current.count,
    suggestedItem: best ? { name: best.name, category: best.category, reason: best.reason } : undefined,
  };
}
