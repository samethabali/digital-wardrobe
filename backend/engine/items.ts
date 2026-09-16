import {
  Category, CATEGORIES, ColorFamily, COLOR_FAMILIES, LayerRole, LAYER_ROLES, Season, SEASONS, UNKNOWN,
  colorFamilyFromName, isValidHex, normalizeTr,
} from '../../shared/wardrobe.js';

/** Öneri motorunun çalıştığı, eksik alanları tahminle doldurulmuş parça. */
export interface EngineItem {
  id: string;
  name: string;
  category: Category;
  subCategory: string;
  colorFamily: ColorFamily | null;
  colorHex: string | null;
  secondaryColors: ColorFamily[];
  material: string;
  pattern: string;
  fit: string;
  style: string;
  formality: number;
  warmth: number;
  waterResistant: boolean;
  layerRole: LayerRole;
  seasons: Season[];
  imagePath: string;
  cutoutImagePath: string | null;
  embedding: number[] | null;
  wearCount: number;
  lastWornAt: Date | null;
  price: number | null;
  /** Veride olmayıp tahmin edilen alanlar */
  inferred: string[];
}

const STYLE_FORMALITY: Record<string, number> = {
  formal: 5, elegant: 4, classic: 4, 'smart-casual': 3, casual: 2, bohemian: 2, streetwear: 2, sport: 1,
};

const includesAny = (text: string, words: string[]) => words.some(w => text.includes(w));

const ONEPIECE_WORDS = ['elbise', 'tulum', 'abiye', 'jumpsuit', 'dress', 'salopet'];

export function inferCategory(category: string | undefined, subCategory: string): Category {
  const sub = normalizeTr(subCategory);
  if ((category === 'top' || category === 'bottom') && includesAny(sub, ONEPIECE_WORDS)) return 'onepiece';
  if (CATEGORIES.includes(category as Category)) return category as Category;
  if (includesAny(sub, ONEPIECE_WORDS)) return 'onepiece';
  if (includesAny(sub, ['mont', 'kaban', 'parka', 'trençkot', 'palto', 'yağmurluk'])) return 'outerwear';
  if (includesAny(sub, ['ayakkabı', 'sneaker', 'bot', 'çizme', 'loafer', 'sandalet', 'topuklu', 'terlik'])) return 'shoes';
  if (includesAny(sub, ['pantolon', 'etek', 'şort', 'jean', 'tayt'])) return 'bottom';
  return 'top';
}

export function inferFormality(style: string, category: Category, subCategory: string): number {
  const sub = normalizeTr(subCategory);
  if (category === 'shoes') {
    if (includesAny(sub, ['stiletto', 'topuklu', 'oxford', 'derby', 'rugan'])) return 5;
    if (includesAny(sub, ['loafer', 'makosen', 'babet', 'chelsea'])) return 4;
    if (includesAny(sub, ['terlik', 'parmak arası'])) return 1;
    if (includesAny(sub, ['koşu', 'spor ayakkabı', 'krampon'])) return 1;
    if (includesAny(sub, ['sneaker', 'sandalet', 'espadril'])) return 2;
  }
  if (includesAny(sub, ['takım elbise', 'smokin', 'abiye'])) return 5;
  if (includesAny(sub, ['blazer', 'gömlek', 'kumaş pantolon', 'pantolon kumaş', 'kalem etek'])) return 4;
  if (includesAny(sub, ['eşofman', 'tayt', 'şort', 'atlet', 'sweatshirt', 'hoodie'])) return Math.min(2, STYLE_FORMALITY[style] ?? 2);
  return STYLE_FORMALITY[style] ?? 2;
}

export function inferWarmth(category: Category, subCategory: string, material: string, weatherMatch: string[]): number {
  const text = `${normalizeTr(subCategory)} ${normalizeTr(material)}`;
  if (category === 'outerwear') {
    if (includesAny(text, ['şişme', 'kaz tüyü', 'parka', 'kürk', 'kaban', 'palto'])) return 5;
    if (includesAny(text, ['mont', 'yün', 'kaşe'])) return 4;
    if (includesAny(text, ['trençkot', 'deri', 'blazer', 'ceket', 'yağmurluk'])) return 3;
    return 3;
  }
  if (category === 'shoes') {
    if (includesAny(text, ['çizme', 'kar botu', 'kürklü'])) return 5;
    if (includesAny(text, ['bot', 'chelsea'])) return 4;
    if (includesAny(text, ['sandalet', 'terlik', 'espadril', 'parmak arası'])) return 1;
    return 2;
  }
  if (includesAny(text, ['kaşmir', 'polar', 'kalın örgü', 'balıkçı'])) return 4;
  if (includesAny(text, ['kazak', 'triko', 'yün', 'sweatshirt', 'hoodie', 'kadife'])) return 4;
  if (includesAny(text, ['hırka', 'gömlek', 'uzun kollu', 'jean', 'denim', 'kumaş pantolon'])) return 3;
  if (includesAny(text, ['şort', 'atlet', 'askılı', 'crop', 'keten', 'ipek', 'şifon', 'tişört', 't-shirt', 'bluz'])) return 2;

  const tags = new Set(weatherMatch || []);
  if (tags.has('snowy') || tags.has('cold')) return 4;
  if (tags.has('hot')) return 1;
  if (tags.has('sunny') && !tags.has('rainy')) return 2;
  return 3;
}

export function inferWaterResistant(category: Category, subCategory: string, material: string, weatherMatch: string[]): boolean {
  if (category !== 'outerwear' && category !== 'shoes') return false;
  const text = `${normalizeTr(subCategory)} ${normalizeTr(material)}`;
  if (includesAny(text, ['su geçirmez', 'yağmurluk', 'trençkot', 'gore', 'naylon', 'deri', 'bot', 'parka', 'şişme'])) return true;
  return (weatherMatch || []).includes('rainy');
}

export function inferLayerRole(category: Category, subCategory: string): LayerRole {
  if (category === 'outerwear') return 'outer';
  if (category === 'top') {
    const sub = normalizeTr(subCategory);
    if (includesAny(sub, ['gömlek', 'hırka', 'yelek', 'blazer', 'ceket', 'overshirt'])) return 'mid';
    return 'base';
  }
  if (category === 'onepiece' || category === 'bottom') return 'base';
  return 'none';
}

export function seasonsFromWarmth(warmth: number): Season[] {
  if (warmth <= 1) return ['yaz'];
  if (warmth === 2) return ['ilkbahar', 'yaz'];
  if (warmth === 3) return ['ilkbahar', 'sonbahar'];
  if (warmth === 4) return ['sonbahar', 'kış'];
  return ['kış'];
}

const clampScale = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(5, Math.max(1, Math.round(value)));
};

/** Veritabanı belgesini motor parçasına çevirir; boş alanlar mevcut bilgilerden tahmin edilir. */
export function toEngineItem(doc: any): EngineItem {
  const inferred: string[] = [];
  const subCategory = doc.subCategory || '';
  const material = doc.material || '';
  const weatherMatch: string[] = Array.isArray(doc.weatherMatch) ? doc.weatherMatch : [];
  const category = inferCategory(doc.category, subCategory);
  if (category !== doc.category) inferred.push('category');

  const style = doc.style || 'casual';

  let formality = clampScale(doc.formality);
  if (formality === null) { formality = inferFormality(style, category, subCategory); inferred.push('formality'); }

  let warmth = clampScale(doc.warmth);
  if (warmth === null) { warmth = inferWarmth(category, subCategory, material, weatherMatch); inferred.push('warmth'); }

  let waterResistant: boolean;
  if (typeof doc.waterResistant === 'boolean') waterResistant = doc.waterResistant;
  else { waterResistant = inferWaterResistant(category, subCategory, material, weatherMatch); inferred.push('waterResistant'); }

  let layerRole: LayerRole;
  if (LAYER_ROLES.includes(doc.layerRole)) layerRole = doc.layerRole;
  else { layerRole = inferLayerRole(category, subCategory); inferred.push('layerRole'); }

  let colorFamily: ColorFamily | null = COLOR_FAMILIES.includes(doc.colorFamily) ? doc.colorFamily : null;
  if (!colorFamily) {
    colorFamily = colorFamilyFromName(doc.color);
    if (colorFamily) inferred.push('colorFamily');
  }

  let seasons: Season[] = Array.isArray(doc.seasons) ? doc.seasons.filter((s: string) => SEASONS.includes(s as Season)) : [];
  if (seasons.length === 0) { seasons = seasonsFromWarmth(warmth); inferred.push('seasons'); }

  const secondaryColors: ColorFamily[] = Array.isArray(doc.secondaryColors)
    ? doc.secondaryColors.filter((c: string) => COLOR_FAMILIES.includes(c as ColorFamily))
    : [];

  return {
    id: doc.id,
    name: doc.name || subCategory || 'Parça',
    category,
    subCategory,
    colorFamily,
    colorHex: isValidHex(doc.colorHex) ? doc.colorHex : null,
    secondaryColors,
    material: material || UNKNOWN,
    pattern: doc.pattern || UNKNOWN,
    fit: doc.fit || UNKNOWN,
    style,
    formality,
    warmth,
    waterResistant,
    layerRole,
    seasons,
    imagePath: doc.imagePath || '',
    cutoutImagePath: doc.cutoutImagePath || null,
    embedding: Array.isArray(doc.embedding) && doc.embedding.length > 0 ? doc.embedding : null,
    wearCount: typeof doc.wearCount === 'number' ? doc.wearCount : 0,
    lastWornAt: doc.lastWornAt ? new Date(doc.lastWornAt) : null,
    price: typeof doc.price === 'number' ? doc.price : null,
    inferred,
  };
}

/** İstemciye gönderilecek parça (embedding gibi iç alanlar olmadan). */
export function toItemDTO(doc: any) {
  const plain = typeof doc?.toObject === 'function' ? doc.toObject() : { ...doc };
  delete plain.embedding;
  delete plain.embeddingModel;
  delete plain.__v;
  return plain;
}
