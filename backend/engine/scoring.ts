import type { ScoreBreakdown } from '../../shared/api.js';
import { ColorFamily, NEUTRAL_COLOR_FAMILIES, COLOR_FAMILY_HEX, UNKNOWN, normalizeTr } from '../../shared/wardrobe.js';
import { cosine } from '../ai/gemini.js';
import type { EngineItem } from './items.js';
import type { StyleContext } from './context.js';

export interface Affinities {
  item: Record<string, number>;
  colorFamily: Record<string, number>;
  style: Record<string, number>;
  fit: Record<string, number>;
  pattern: Record<string, number>;
}

export interface PreferenceData {
  affinities: Affinities | null;
  preferredFits: string[];
  avoidFits: string[];
  dislikedColorFamilies: string[];
  bestColorFamilies: string[];
  avoidColorFamilies: string[];
}

export interface ScoringDeps {
  prefs?: PreferenceData | null;
  /** Son gösterilen / giyilen kombinlerin parça kimlikleri */
  recentOutfits?: string[][];
  /** Parça kimliği → kaç gün önce giyildiği */
  recentlyWorn?: Map<string, number>;
  /** Zorunlu / kilitli parçalar: tekrar cezası uygulanmaz */
  protectedIds?: Set<string>;
  /** Eğitilmiş yeniden sıralayıcı (0-1 olasılık döndürür) */
  learned?: ((features: number[]) => number) | null;
}

export const WEIGHTS = {
  weather: 0.24,
  formality: 0.2,
  color: 0.2,
  style: 0.12,
  silhouette: 0.09,
  preference: 0.08,
  variety: 0.07,
  learned: 0.1,
};

const MAIN_CATEGORIES = new Set(['top', 'bottom', 'onepiece', 'outerwear', 'shoes']);
const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v));
const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

export interface OutfitSlots {
  top?: EngineItem;
  bottom?: EngineItem;
  onepiece?: EngineItem;
  outer?: EngineItem;
  shoes?: EngineItem;
  accessories: EngineItem[];
  makeup: EngineItem[];
}

export function toSlots(items: EngineItem[]): OutfitSlots {
  const slots: OutfitSlots = { accessories: [], makeup: [] };
  for (const item of items) {
    if (item.category === 'top') slots.top = item;
    else if (item.category === 'bottom') slots.bottom = item;
    else if (item.category === 'onepiece') slots.onepiece = item;
    else if (item.category === 'outerwear') slots.outer = item;
    else if (item.category === 'shoes') slots.shoes = item;
    else if (item.category === 'accessory') slots.accessories.push(item);
    else if (item.category === 'makeup') slots.makeup.push(item);
  }
  return slots;
}

// ─── Hava ──────────────────────────────────────────────────────────────────
export function weatherScore(items: EngineItem[], ctx: StyleContext): number | null {
  if (!ctx.weather || !ctx.tempBand || !ctx.insulation) return null;
  const s = toSlots(items);
  let score = 100;

  const upper = s.onepiece || s.top;
  const insulation = (upper?.warmth ?? 2) + (s.outer?.warmth ?? 0);
  if (insulation < ctx.insulation.min) score -= 16 * (ctx.insulation.min - insulation);
  else if (insulation > ctx.insulation.max) score -= 12 * (insulation - ctx.insulation.max);

  if (s.outer) {
    if (ctx.outerwear === 'avoid') score -= 35;
    if (ctx.minOuterWarmth && s.outer.warmth < ctx.minOuterWarmth) score -= 15 * (ctx.minOuterWarmth - s.outer.warmth);
    if (ctx.needsWaterResistant && !s.outer.waterResistant) score -= 10;
  } else if (ctx.outerwear === 'required') {
    score -= 35;
  } else if (ctx.outerwear === 'recommended') {
    score -= 12;
  }

  const coldBand = ctx.tempBand === 'cold' || ctx.tempBand === 'freezing';
  if (s.bottom) {
    if (ctx.tempBand === 'hot' && s.bottom.warmth >= 4) score -= 15;
    if (coldBand && s.bottom.warmth <= 1) score -= 25;
  }
  if (s.onepiece && ctx.tempBand === 'freezing' && s.onepiece.warmth <= 2) score -= 10;
  if (s.shoes) {
    if (coldBand && s.shoes.warmth <= 1) score -= 30;
    if (ctx.tempBand === 'hot' && s.shoes.warmth >= 4) score -= 15;
    if (ctx.precipitation === 'rain' && !s.shoes.waterResistant) score -= 8;
    if (ctx.precipitation === 'snow' && (!s.shoes.waterResistant || s.shoes.warmth <= 2)) score -= 20;
  }

  const offSeason = items.filter(i => MAIN_CATEGORIES.has(i.category) && i.seasons.length > 0 && !i.seasons.includes(ctx.season)).length;
  score -= 4 * offSeason;

  return clamp(score);
}

// ─── Resmiyet ──────────────────────────────────────────────────────────────
export function formalityScore(items: EngineItem[], ctx: StyleContext): number {
  const main = items.filter(i => MAIN_CATEGORIES.has(i.category));
  if (main.length === 0) return 50;
  const { min, max, target } = ctx.formality;
  const distances = main.map(i => (i.formality < min ? min - i.formality : i.formality > max ? i.formality - max : 0));
  const values = main.map(i => i.formality);
  let penalty = mean(distances) * 22;
  penalty += Math.abs(mean(values) - target) * 8;
  penalty += Math.max(0, Math.max(...values) - Math.min(...values) - 1) * 10;
  if (ctx.activity >= 4) penalty += main.filter(i => i.formality >= 4).length * 15;
  return clamp(100 - penalty);
}

// ─── Renk ──────────────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}

export function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;
  const [r, g, b] = rgb.map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function lightness(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;
  return (Math.max(...rgb) + Math.min(...rgb)) / 2 / 255;
}

const itemHex = (item: EngineItem) => item.colorHex || (item.colorFamily ? COLOR_FAMILY_HEX[item.colorFamily] : null);
const isNeutral = (family: ColorFamily) => NEUTRAL_COLOR_FAMILIES.includes(family);
const pairKey = (a: string, b: string) => [a, b].sort((x, y) => x.localeCompare(y, 'tr')).join('|');

// İki vurgu rengi bir aradayken beklenen uyum (renk teorisi: tamamlayıcı, komşu, çatışan)
const ACCENT_PAIR_SCORES: Record<string, number> = {
  [pairKey('mavi', 'turuncu')]: 82,
  [pairKey('mor', 'sarı')]: 78,
  [pairKey('bordo', 'yeşil')]: 80,
  [pairKey('pembe', 'yeşil')]: 76,
  [pairKey('mavi', 'pembe')]: 78,
  [pairKey('mavi', 'sarı')]: 74,
  [pairKey('bordo', 'kırmızı')]: 78,
  [pairKey('bordo', 'pembe')]: 74,
  [pairKey('bordo', 'sarı')]: 76,
  [pairKey('mor', 'pembe')]: 76,
  [pairKey('sarı', 'turuncu')]: 72,
  [pairKey('mavi', 'yeşil')]: 72,
  [pairKey('mavi', 'mor')]: 70,
  [pairKey('kırmızı', 'mavi')]: 70,
  [pairKey('turuncu', 'yeşil')]: 66,
  [pairKey('pembe', 'sarı')]: 62,
  [pairKey('kırmızı', 'pembe')]: 56,
  [pairKey('pembe', 'turuncu')]: 56,
  [pairKey('kırmızı', 'turuncu')]: 55,
  [pairKey('kırmızı', 'mor')]: 52,
  [pairKey('mor', 'turuncu')]: 50,
  [pairKey('kırmızı', 'yeşil')]: 45,
};

export const COMPLEMENTARY_PAIRS = new Set([
  pairKey('mavi', 'turuncu'), pairKey('mor', 'sarı'), pairKey('kırmızı', 'yeşil'), pairKey('bordo', 'yeşil'),
]);

export function colorScore(items: EngineItem[], ctx: StyleContext, prefs?: PreferenceData | null): number {
  const s = toSlots(items);
  const main = items.filter(i => MAIN_CATEGORIES.has(i.category));
  const known = main.filter(i => i.colorFamily);
  const accents = new Set<ColorFamily>();
  for (const item of known) {
    if (!isNeutral(item.colorFamily!)) accents.add(item.colorFamily!);
  }
  const tags = new Set(ctx.styleTags);
  const neutralFamilies = new Set(known.filter(i => isNeutral(i.colorFamily!)).map(i => i.colorFamily!));

  let score: number;
  if (accents.size === 0) {
    score = 82;
    const upper = s.onepiece || s.top;
    const upperHex = upper ? itemHex(upper) : null;
    const lowerHex = s.bottom ? itemHex(s.bottom) : null;
    if (neutralFamilies.size >= 2 && upperHex && lowerHex && Math.abs(luminance(upperHex) - luminance(lowerHex)) >= 0.25) score += 6;
  } else if (accents.size === 1) {
    score = accents.has('çok renkli') ? 78 : 92;
  } else if (accents.size === 2) {
    const [a, b] = Array.from(accents);
    if (a === 'çok renkli' || b === 'çok renkli') score = 55;
    else score = ACCENT_PAIR_SCORES[pairKey(a, b)] ?? 62;
  } else {
    score = tags.has('Maximalist') ? 65 : 35;
  }

  // Stil etiketleri
  const families = new Set(known.filter(i => i.category !== 'shoes').map(i => i.colorFamily!));
  if (tags.has('Monokromatik')) score += families.size <= 1 ? 10 : -10;
  if (tags.has('Nötr Tonlar')) score += accents.size === 0 ? 10 : -10;
  if (tags.has('Tamamlayıcı')) {
    const pair = accents.size === 2 ? pairKey(...(Array.from(accents) as [string, string])) : '';
    score += COMPLEMENTARY_PAIRS.has(pair) ? 12 : -4;
  }
  if (tags.has('Pastel')) {
    const accentItems = known.filter(i => !isNeutral(i.colorFamily!));
    const light = accentItems.filter(i => lightness(itemHex(i)!) >= 0.7).length;
    score += accentItems.length && light === accentItems.length ? 10 : -6;
  }
  if (tags.has('Kontrast')) {
    const upper = s.onepiece || s.top;
    const upperHex = upper ? itemHex(upper) : null;
    const lowerHex = s.bottom ? itemHex(s.bottom) : s.shoes ? itemHex(s.shoes) : null;
    if (upperHex && lowerHex) score += Math.abs(luminance(upperHex) - luminance(lowerHex)) >= 0.35 ? 10 : -5;
  }

  // Desen karışımı
  const patterned = main.filter(i => (i.pattern && i.pattern !== 'düz' && i.pattern !== UNKNOWN) || i.colorFamily === 'çok renkli').length;
  if (patterned === 1) score += 4;
  else if (patterned === 2) score -= 12;
  else if (patterned >= 3) score -= 28;
  if (tags.has('Minimalist') && patterned >= 1) score -= 8;

  // Aksesuar zaten kalabalık bir paleti daha da kalabalıklaştırmasın
  const accentAccessories = s.accessories.filter(a => a.colorFamily && !isNeutral(a.colorFamily)).length;
  if (accentAccessories > 0 && accents.size >= 2) score -= 5;

  // Deri kemer ile deri ayakkabının tonu aynı ailede olmalı (siyah–siyah, kahve–kahve)
  const leatherTones = ['siyah', 'kahverengi'];
  const shoeTone = s.shoes && normalizeTr(s.shoes.material).includes('deri') ? s.shoes.colorFamily : null;
  if (shoeTone && leatherTones.includes(shoeTone)) {
    for (const accessory of s.accessories) {
      if (normalizeTr(accessory.subCategory).includes('kemer') && accessory.colorFamily
        && leatherTones.includes(accessory.colorFamily) && accessory.colorFamily !== shoeTone) {
        score -= ctx.formality.target >= 3 ? 8 : 4;
      }
    }
  }

  if (prefs) {
    const faceItems = [s.top, s.onepiece, s.outer].filter(Boolean) as EngineItem[];
    for (const item of faceItems) {
      if (!item.colorFamily) continue;
      if (prefs.bestColorFamilies.includes(item.colorFamily)) score += 3;
      if (prefs.avoidColorFamilies.includes(item.colorFamily)) score -= 8;
    }
    const disliked = items.filter(i => i.colorFamily && prefs.dislikedColorFamilies.includes(i.colorFamily)).length;
    score -= disliked * 15;
  }

  // Rengi bilinmeyen parça çoksa puan belirsizliğe doğru çekilir
  const unknownShare = main.length ? (main.length - known.length) / main.length : 0;
  if (unknownShare > 0) score = score * (1 - unknownShare * 0.5) + 70 * unknownShare * 0.5;

  return clamp(score);
}

// ─── Stil ──────────────────────────────────────────────────────────────────
const STYLE_COMPAT_PAIRS: Array<[string, string, number]> = [
  ['casual', 'smart-casual', 0.8], ['casual', 'streetwear', 0.8], ['casual', 'sport', 0.6], ['casual', 'bohemian', 0.7],
  ['casual', 'classic', 0.6], ['casual', 'elegant', 0.4], ['casual', 'formal', 0.2],
  ['smart-casual', 'classic', 0.9], ['smart-casual', 'elegant', 0.7], ['smart-casual', 'formal', 0.6],
  ['smart-casual', 'streetwear', 0.5], ['smart-casual', 'bohemian', 0.5], ['smart-casual', 'sport', 0.3],
  ['formal', 'elegant', 0.9], ['formal', 'classic', 0.9], ['formal', 'streetwear', 0.1], ['formal', 'sport', 0.05], ['formal', 'bohemian', 0.2],
  ['elegant', 'classic', 0.85], ['elegant', 'bohemian', 0.5], ['elegant', 'streetwear', 0.2], ['elegant', 'sport', 0.1],
  ['classic', 'streetwear', 0.3], ['classic', 'sport', 0.2], ['classic', 'bohemian', 0.4],
  ['sport', 'streetwear', 0.75], ['sport', 'bohemian', 0.2],
  ['streetwear', 'bohemian', 0.4],
];
const STYLE_COMPAT = new Map(STYLE_COMPAT_PAIRS.map(([a, b, v]) => [pairKey(a, b), v]));

export function styleCompat(a: string, b: string): number {
  if (a === b) return 1;
  return STYLE_COMPAT.get(pairKey(a, b)) ?? 0.6;
}

export const TAG_STYLE_TARGETS: Record<string, string[]> = {
  'Sporty': ['sport', 'streetwear'],
  'Streetwear': ['streetwear', 'casual'],
  'Business Casual': ['smart-casual', 'classic'],
  'Klasik': ['classic', 'formal', 'smart-casual'],
  'Boho': ['bohemian'],
  'Romantic': ['elegant', 'bohemian'],
  'Preppy': ['classic', 'smart-casual'],
  'Dark Academia': ['classic', 'smart-casual'],
  'Vintage': ['classic', 'bohemian'],
  'Y2K': ['streetwear', 'casual'],
  'Minimalist': ['classic', 'smart-casual', 'casual'],
  'Maximalist': ['bohemian', 'streetwear', 'elegant'],
};

export const MOOD_STYLE_TARGETS: Record<string, string[]> = {
  'Enerjik': ['sport', 'streetwear', 'casual'],
  'Romantik': ['elegant', 'bohemian'],
  'Ciddi': ['formal', 'classic', 'smart-casual'],
  'Rahat': ['casual', 'sport'],
  'Minimalist': ['classic', 'smart-casual'],
};

// Etkinliğin doğal stil karakteri (stil etiketlerinden daha düşük ağırlıkla)
export const EVENT_STYLE_TARGETS: Record<string, string[]> = {
  'Gündelik': ['casual', 'smart-casual', 'streetwear'],
  'Ofis': ['smart-casual', 'classic', 'formal'],
  'İş Görüşmesi': ['formal', 'classic', 'smart-casual'],
  'Randevu': ['elegant', 'smart-casual', 'classic'],
  'Parti': ['elegant', 'streetwear', 'bohemian'],
  'Düğün/Davet': ['formal', 'elegant', 'classic'],
  'Spor': ['sport'],
  'Seyahat': ['casual', 'smart-casual', 'sport'],
  'Okul': ['casual', 'streetwear', 'sport'],
};

const EVENING_MATERIALS = ['saten', 'ipek', 'kadife', 'deri', 'payet', 'simli', 'dantel'];

export function styleScore(items: EngineItem[], ctx: StyleContext): number {
  const main = items.filter(i => MAIN_CATEGORIES.has(i.category));
  if (main.length < 2) return 70;
  const pairs: number[] = [];
  for (let i = 0; i < main.length; i++) {
    for (let j = i + 1; j < main.length; j++) pairs.push(styleCompat(main[i].style, main[j].style));
  }
  let score = 30 + 70 * mean(pairs);

  const eventTargets = EVENT_STYLE_TARGETS[ctx.event];
  if (eventTargets) {
    const garments = main.filter(i => i.category !== 'shoes');
    const share = garments.length ? garments.filter(i => eventTargets.includes(i.style)).length / garments.length : 0;
    score += 12 * share - 4;
  }
  if (ctx.event === 'Parti' || ctx.event === 'Düğün/Davet' || (ctx.event === 'Randevu' && ctx.dressiness >= 4)) {
    const eveningPiece = main.some(i => i.category !== 'shoes' && EVENING_MATERIALS.some(m => normalizeTr(i.material).includes(m)));
    score += eveningPiece ? 6 : -4;
  }

  const targets = new Set<string>();
  for (const tag of ctx.styleTags) (TAG_STYLE_TARGETS[tag] || []).forEach(t => targets.add(t));
  if (ctx.mood) (MOOD_STYLE_TARGETS[ctx.mood] || []).forEach(t => targets.add(t));
  if (targets.size > 0) {
    const share = main.filter(i => targets.has(i.style)).length / main.length;
    score += 18 * share - 6;
  }

  // Görsel + metin embedding'leri varsa parçaların "aynı dünyadan" olup olmadığı küçük bir sinyal olarak eklenir
  const embedded = main.filter(i => i.embedding);
  if (embedded.length >= 2) {
    const sims: number[] = [];
    for (let i = 0; i < embedded.length; i++) {
      for (let j = i + 1; j < embedded.length; j++) {
        const sim = cosine(embedded[i].embedding, embedded[j].embedding);
        if (sim !== null) sims.push(sim);
      }
    }
    if (sims.length) {
      const coherence = clamp((mean(sims) - 0.55) / 0.35, 0, 1);
      score = score * 0.75 + 100 * coherence * 0.25;
    }
  }
  return clamp(score);
}

// ─── Silüet ────────────────────────────────────────────────────────────────
const VOLUME: Record<string, number> = { dar: 1, crop: 1.5, normal: 2, bol: 3, oversize: 4 };

export function silhouetteScore(items: EngineItem[], ctx: StyleContext, prefs?: PreferenceData | null): number {
  const s = toSlots(items);
  const tags = new Set(ctx.styleTags);
  let score: number;

  if (s.onepiece) {
    score = 82;
    const outerVol = s.outer ? VOLUME[s.outer.fit] : undefined;
    const pieceVol = VOLUME[s.onepiece.fit];
    if (outerVol !== undefined && pieceVol !== undefined && outerVol >= 4 && pieceVol >= 3) score -= 8;
  } else if (s.top && s.bottom) {
    const vu = VOLUME[s.top.fit];
    const vl = VOLUME[s.bottom.fit];
    if (vu === undefined || vl === undefined) score = 72;
    else if (vu >= 3 && vl >= 3) score = tags.has('Oversize') ? 76 : 58;
    else if (vu <= 1.5 && vl <= 1.5) score = 74;
    else if (Math.abs(vu - vl) >= 1) score = 90;
    else score = 80;
    if (s.top.fit === 'crop' && vl !== undefined && vl >= 2) score = Math.max(score, 88);
    if (tags.has('Oversize') && ((vu ?? 0) >= 3.5 || (vl ?? 0) >= 3.5)) score += 8;
    if (tags.has('Fitted') && (vu ?? 3) <= 2 && (vl ?? 3) <= 2) score += 8;
    if (tags.has('Crop & High-waist') && s.top.fit === 'crop') score += 8;
  } else {
    score = 60;
  }

  if (tags.has('Katmanlı')) score += s.outer || s.top?.layerRole === 'mid' ? 6 : -4;

  if (prefs) {
    const garments = [s.top, s.bottom, s.onepiece, s.outer].filter(Boolean) as EngineItem[];
    const preferred = garments.filter(i => prefs.preferredFits.includes(i.fit)).length;
    const avoided = garments.filter(i => prefs.avoidFits.includes(i.fit)).length;
    score += Math.min(8, preferred * 4) - Math.min(20, avoided * 10);
  }
  return clamp(score);
}

// ─── Kişisel tercih ────────────────────────────────────────────────────────
export function preferenceScore(items: EngineItem[], prefs?: PreferenceData | null): number | null {
  const aff = prefs?.affinities;
  if (!aff) return null;
  const values = items.filter(i => i.category !== 'makeup').map(item => {
    const attrs = [
      item.colorFamily ? aff.colorFamily[item.colorFamily] : undefined,
      aff.style[item.style],
      aff.fit[item.fit],
      aff.pattern[item.pattern],
    ].filter((v): v is number => typeof v === 'number');
    const itemAff = aff.item[item.id] ?? 0;
    return Math.tanh((itemAff + 0.7 * mean(attrs)) / 4);
  });
  return clamp(50 + 45 * mean(values));
}

// ─── Çeşitlilik ────────────────────────────────────────────────────────────
export function varietyScore(items: EngineItem[], deps: ScoringDeps): number {
  const ids = new Set(items.map(i => i.id));
  let penalty = 0;
  for (const recent of (deps.recentOutfits || []).slice(0, 20)) {
    if (!recent.length) continue;
    const overlap = recent.filter(id => ids.has(id)).length / Math.max(ids.size, recent.length);
    if (overlap >= 0.999) penalty = Math.max(penalty, 60);
    else if (overlap >= 0.75) penalty = Math.max(penalty, 25);
  }
  let wornPenalty = 0;
  for (const id of ids) {
    if (deps.protectedIds?.has(id)) continue;
    const days = deps.recentlyWorn?.get(id);
    if (days !== undefined && days <= 2) wornPenalty += 10;
  }
  return clamp(100 - penalty - Math.min(30, wornPenalty));
}

// ─── Toplam ────────────────────────────────────────────────────────────────
export function outfitFeatures(parts: Omit<ScoreBreakdown, 'total' | 'learned'>, items: EngineItem[]): number[] {
  const main = items.filter(i => MAIN_CATEGORIES.has(i.category));
  const patterned = main.filter(i => i.pattern && i.pattern !== 'düz' && i.pattern !== UNKNOWN).length;
  return [
    (parts.weather ?? 75) / 100,
    parts.formality / 100,
    parts.color / 100,
    parts.style / 100,
    parts.silhouette / 100,
    (parts.preference ?? 50) / 100,
    parts.variety / 100,
    items.length / 6,
    items.some(i => i.category === 'outerwear') ? 1 : 0,
    patterned / 3,
    mean(main.map(i => i.formality)) / 5,
    mean(main.map(i => i.warmth)) / 5,
  ];
}

export function scoreOutfit(items: EngineItem[], ctx: StyleContext, deps: ScoringDeps = {}): ScoreBreakdown {
  const parts = {
    weather: weatherScore(items, ctx),
    formality: formalityScore(items, ctx),
    color: colorScore(items, ctx, deps.prefs),
    style: styleScore(items, ctx),
    silhouette: silhouetteScore(items, ctx, deps.prefs),
    preference: preferenceScore(items, deps.prefs),
    variety: varietyScore(items, deps),
  };
  const learned = deps.learned ? clamp(deps.learned(outfitFeatures(parts, items)) * 100) : null;

  let weighted = 0;
  let weightSum = 0;
  const add = (value: number | null, weight: number) => {
    if (value === null) return;
    weighted += value * weight;
    weightSum += weight;
  };
  add(parts.weather, WEIGHTS.weather);
  add(parts.formality, WEIGHTS.formality);
  add(parts.color, WEIGHTS.color);
  add(parts.style, WEIGHTS.style);
  add(parts.silhouette, WEIGHTS.silhouette);
  add(parts.preference, WEIGHTS.preference);
  add(parts.variety, WEIGHTS.variety);
  add(learned, WEIGHTS.learned);

  const round = (v: number | null) => (v === null ? null : Math.round(v));
  return {
    weather: round(parts.weather),
    formality: Math.round(parts.formality),
    color: Math.round(parts.color),
    style: Math.round(parts.style),
    silhouette: Math.round(parts.silhouette),
    preference: round(parts.preference),
    variety: Math.round(parts.variety),
    learned: round(learned),
    total: Math.round(weightSum ? weighted / weightSum : 0),
  };
}
