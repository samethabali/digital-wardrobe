// Web arayüzü ve backend'in ortak kullandığı gardırop sözlüğü.
// Buradaki değerler veritabanına ve Gemini şemalarına aynen yazılır; bir değeri değiştirmeden önce mevcut kayıtları düşün.

export const UNKNOWN = 'belirsiz' as const;

export const CATEGORIES = ['top', 'bottom', 'onepiece', 'outerwear', 'shoes', 'accessory', 'makeup'] as const;
export type Category = typeof CATEGORIES[number];

export const CATEGORY_LABELS: Record<string, string> = {
  all: 'Tümü',
  top: 'Üst',
  bottom: 'Alt',
  onepiece: 'Tek Parça',
  outerwear: 'Dış Giyim',
  shoes: 'Ayakkabı',
  accessory: 'Aksesuar',
  makeup: 'Makyaj',
};

export const STYLES = ['casual', 'smart-casual', 'formal', 'elegant', 'classic', 'sport', 'streetwear', 'bohemian'] as const;
export type Style = typeof STYLES[number];

export const STYLE_LABELS: Record<string, string> = {
  casual: 'Günlük',
  'smart-casual': 'Smart Casual',
  formal: 'Resmi',
  elegant: 'Zarif',
  classic: 'Klasik',
  sport: 'Spor',
  streetwear: 'Sokak',
  bohemian: 'Bohem',
};

export const COLOR_FAMILIES = [
  'siyah', 'beyaz', 'gri', 'lacivert', 'mavi', 'kahverengi', 'bej', 'haki',
  'yeşil', 'kırmızı', 'bordo', 'pembe', 'mor', 'sarı', 'turuncu', 'çok renkli',
] as const;
export type ColorFamily = typeof COLOR_FAMILIES[number];

// Kombinde "zemin" görevi gören renkler; bunların dışındakiler vurgu rengi sayılır.
export const NEUTRAL_COLOR_FAMILIES: readonly ColorFamily[] = ['siyah', 'beyaz', 'gri', 'lacivert', 'kahverengi', 'bej', 'haki'];

export const COLOR_FAMILY_HEX: Record<ColorFamily, string> = {
  siyah: '#111827',
  beyaz: '#F9FAFB',
  gri: '#9CA3AF',
  lacivert: '#1E3A8A',
  mavi: '#3B82F6',
  kahverengi: '#78350F',
  bej: '#E7D8C0',
  haki: '#6B705C',
  yeşil: '#16A34A',
  kırmızı: '#DC2626',
  bordo: '#7F1D1D',
  pembe: '#EC4899',
  mor: '#7C3AED',
  sarı: '#EAB308',
  turuncu: '#EA580C',
  'çok renkli': '#A855F7',
};

export const PATTERNS = ['düz', 'çizgili', 'kareli', 'çiçekli', 'grafik', 'noktalı', 'hayvan', 'kamuflaj', 'batik', UNKNOWN] as const;
export type Pattern = typeof PATTERNS[number];

export const PATTERN_LABELS: Record<string, string> = {
  düz: 'Düz',
  çizgili: 'Çizgili',
  kareli: 'Kareli',
  çiçekli: 'Çiçekli',
  grafik: 'Grafik / Baskı',
  noktalı: 'Noktalı',
  hayvan: 'Hayvan Deseni',
  kamuflaj: 'Kamuflaj',
  batik: 'Batik / Tie-dye',
  [UNKNOWN]: 'Belirsiz',
};

export const FITS = ['dar', 'normal', 'bol', 'oversize', 'crop', UNKNOWN] as const;
export type Fit = typeof FITS[number];

export const FIT_LABELS: Record<string, string> = {
  dar: 'Dar / Slim',
  normal: 'Normal / Regular',
  bol: 'Bol / Loose',
  oversize: 'Oversize',
  crop: 'Crop',
  [UNKNOWN]: 'Belirsiz',
};

export const LAYER_ROLES = ['base', 'mid', 'outer', 'none'] as const;
export type LayerRole = typeof LAYER_ROLES[number];

export const LAYER_ROLE_LABELS: Record<string, string> = {
  base: 'İç / tek kat',
  mid: 'Ara kat (gömlek, hırka)',
  outer: 'Dış katman',
  none: 'Katman değil',
};

export const SEASONS = ['ilkbahar', 'yaz', 'sonbahar', 'kış'] as const;
export type Season = typeof SEASONS[number];

export const SEASON_LABELS: Record<string, string> = {
  ilkbahar: 'İlkbahar',
  yaz: 'Yaz',
  sonbahar: 'Sonbahar',
  kış: 'Kış',
};

// Mobil uygulamanın hâlâ okuduğu eski hava etiketleri; yeni alanlardan otomatik türetilir.
export const WEATHERS = ['sunny', 'cloudy', 'rainy', 'snowy', 'hot', 'cold'] as const;

export const WARMTH_LABELS: Record<number, string> = {
  1: 'Çok ince',
  2: 'İnce',
  3: 'Orta',
  4: 'Kalın',
  5: 'Çok kalın',
};

export const FORMALITY_LABELS: Record<number, string> = {
  1: 'Spor / çok rahat',
  2: 'Günlük',
  3: 'Smart casual',
  4: 'Şık / iş',
  5: 'Resmi / gece',
};

export const EVENTS = ['Gündelik', 'Ofis', 'İş Görüşmesi', 'Randevu', 'Parti', 'Düğün/Davet', 'Spor', 'Seyahat', 'Okul'] as const;
export type EventKey = typeof EVENTS[number];

export const MOODS = ['Enerjik', 'Minimalist', 'Romantik', 'Ciddi', 'Rahat'] as const;

export const STYLE_TAG_GROUPS = [
  {
    label: 'Renk Uyumu',
    tags: ['Monokromatik', 'Tamamlayıcı', 'Kontrast', 'Pastel', 'Nötr Tonlar'],
  },
  {
    label: 'Stil Karakteri',
    tags: ['Minimalist', 'Maximalist', 'Klasik', 'Vintage', 'Streetwear', 'Preppy', 'Boho', 'Dark Academia', 'Y2K', 'Sporty', 'Business Casual', 'Romantic'],
  },
  {
    label: 'Kesim & Katman',
    tags: ['Katmanlı', 'Oversize', 'Fitted', 'Crop & High-waist'],
  },
];

export const STYLE_TAGS = STYLE_TAG_GROUPS.flatMap(g => g.tags);

export const FEEDBACK_REASONS = [
  { value: 'renk', label: 'Renkler uymadı' },
  { value: 'tarz', label: 'Tarzıma uygun değil' },
  { value: 'resmiyet', label: 'Etkinliğe uygun değil' },
  { value: 'hava', label: 'Havaya uygun değil' },
  { value: 'kesim', label: 'Kesim / oran hoşuma gitmedi' },
  { value: 'diger', label: 'Diğer' },
] as const;
export type FeedbackReason = typeof FEEDBACK_REASONS[number]['value'];

export const GARMENT_CATEGORIES: readonly Category[] = ['top', 'bottom', 'onepiece', 'outerwear'];

export interface ItemAttributes {
  category?: string;
  subCategory?: string;
  color?: string;
  colorFamily?: string | null;
  colorHex?: string | null;
  secondaryColors?: string[];
  material?: string;
  pattern?: string;
  fit?: string;
  style?: string;
  formality?: number | null;
  warmth?: number | null;
  waterResistant?: boolean | null;
  layerRole?: string | null;
  seasons?: string[];
}

const isEmpty = (value: unknown) => value === undefined || value === null || value === '';

/**
 * Bir parçada öneri motorunun ihtiyaç duyduğu ama boş olan alanları döndürür.
 * "belirsiz" bilinçli bir cevaptır, eksik sayılmaz.
 */
export function missingFields(item: ItemAttributes): string[] {
  const missing: string[] = [];
  const category = item.category || '';

  if (isEmpty(item.subCategory)) missing.push('subCategory');
  if (isEmpty(item.colorFamily)) missing.push('colorFamily');
  if (isEmpty(item.style)) missing.push('style');

  if (category !== 'makeup') {
    if (isEmpty(item.formality)) missing.push('formality');
    if (category !== 'accessory' && isEmpty(item.warmth)) missing.push('warmth');
  }

  if (GARMENT_CATEGORIES.includes(category as Category)) {
    if (isEmpty(item.material)) missing.push('material');
    if (isEmpty(item.pattern)) missing.push('pattern');
    if (isEmpty(item.fit)) missing.push('fit');
    if (isEmpty(item.layerRole)) missing.push('layerRole');
  }

  if ((category === 'outerwear' || category === 'shoes') && (item.waterResistant === undefined || item.waterResistant === null)) {
    missing.push('waterResistant');
  }

  if (!['makeup', 'accessory'].includes(category) && !(item.seasons && item.seasons.length)) {
    missing.push('seasons');
  }

  return missing;
}

/** Mobil uygulama ve eski ekranlar için yeni alanlardan eski hava etiketlerini üretir. */
export function deriveWeatherMatch(item: ItemAttributes): string[] {
  const tags = new Set<string>();
  const warmth = item.warmth ?? 3;
  if (warmth <= 2) { tags.add('sunny'); tags.add('hot'); }
  if (warmth === 3) { tags.add('sunny'); tags.add('cloudy'); }
  if (warmth >= 4) { tags.add('cloudy'); tags.add('cold'); }
  if (warmth >= 5) tags.add('snowy');
  if (item.waterResistant) tags.add('rainy');
  return Array.from(tags);
}

export function normalizeTr(text: string | undefined | null): string {
  return (text || '').toLocaleLowerCase('tr-TR').trim();
}

// Serbest renk adlarından renk ailesine eşleme (eski kayıtlar ve elle girilen renkler için).
const COLOR_NAME_HINTS: Array<[string, ColorFamily]> = [
  ['çok renkli', 'çok renkli'], ['renkli', 'çok renkli'], ['multi', 'çok renkli'],
  ['lacivert', 'lacivert'], ['indigo', 'lacivert'], ['navy', 'lacivert'],
  ['bordo', 'bordo'], ['şarap', 'bordo'], ['vişne', 'bordo'],
  ['haki', 'haki'], ['zeytin', 'haki'], ['asker', 'haki'],
  ['antrasit', 'gri'], ['füme', 'gri'], ['gümüş', 'gri'], ['gri', 'gri'],
  ['siyah', 'siyah'], ['black', 'siyah'],
  ['beyaz', 'beyaz'], ['white', 'beyaz'],
  ['ekru', 'bej'], ['krem', 'bej'], ['taş', 'bej'], ['bej', 'bej'], ['camel', 'kahverengi'],
  ['taba', 'kahverengi'], ['kahve', 'kahverengi'], ['vizon', 'kahverengi'], ['brown', 'kahverengi'],
  ['pudra', 'pembe'], ['fuşya', 'pembe'], ['somon', 'pembe'], ['pembe', 'pembe'], ['pink', 'pembe'],
  ['lila', 'mor'], ['lavanta', 'mor'], ['mor', 'mor'], ['purple', 'mor'],
  ['hardal', 'sarı'], ['altın', 'sarı'], ['sarı', 'sarı'], ['yellow', 'sarı'],
  ['kiremit', 'turuncu'], ['turuncu', 'turuncu'], ['orange', 'turuncu'],
  ['kırmızı', 'kırmızı'], ['red', 'kırmızı'],
  ['mint', 'yeşil'], ['zümrüt', 'yeşil'], ['yeşil', 'yeşil'], ['green', 'yeşil'],
  ['kot', 'mavi'], ['denim', 'mavi'], ['turkuaz', 'mavi'], ['mavi', 'mavi'], ['blue', 'mavi'],
];

export function colorFamilyFromName(name: string | undefined | null): ColorFamily | null {
  const normalized = normalizeTr(name);
  if (!normalized) return null;
  for (const [hint, family] of COLOR_NAME_HINTS) {
    if (normalized.includes(hint)) return family;
  }
  return null;
}

export function isValidHex(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

export function seasonForDate(date: Date): Season {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return 'ilkbahar';
  if (month >= 6 && month <= 8) return 'yaz';
  if (month >= 9 && month <= 11) return 'sonbahar';
  return 'kış';
}
