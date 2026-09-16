// Değerlendirme betiği ve birim testleri için deterministik örnek gardıroplar ve senaryolar.
import type { WeatherSnapshot, StylistRequest } from '../../shared/api.js';
import { COLOR_FAMILY_HEX, ColorFamily } from '../../shared/wardrobe.js';

interface Template {
  sub: string;
  category: string;
  style: string;
  formality: number;
  warmth: number;
  material: string;
  pattern?: string;
  fit?: string;
  layerRole?: string;
  waterResistant?: boolean;
  seasons: string[];
  colors: ColorFamily[];
}

const ALL_SEASONS = ['ilkbahar', 'yaz', 'sonbahar', 'kış'];
const WARM = ['ilkbahar', 'yaz'];
const COLD = ['sonbahar', 'kış'];
const MID = ['ilkbahar', 'sonbahar'];

const TEMPLATES: Template[] = [
  // Üst
  { sub: 'basic tişört', category: 'top', style: 'casual', formality: 2, warmth: 2, material: 'pamuk', pattern: 'düz', fit: 'normal', layerRole: 'base', seasons: WARM, colors: ['beyaz', 'siyah', 'gri', 'lacivert'] },
  { sub: 'gömlek', category: 'top', style: 'smart-casual', formality: 4, warmth: 3, material: 'pamuk', pattern: 'düz', fit: 'normal', layerRole: 'mid', seasons: ALL_SEASONS, colors: ['beyaz', 'mavi', 'lacivert'] },
  { sub: 'kazak', category: 'top', style: 'casual', formality: 2, warmth: 4, material: 'yün', pattern: 'düz', fit: 'normal', layerRole: 'base', seasons: COLD, colors: ['gri', 'bej', 'bordo', 'haki'] },
  { sub: 'saten bluz', category: 'top', style: 'elegant', formality: 4, warmth: 2, material: 'saten', pattern: 'düz', fit: 'normal', layerRole: 'base', seasons: ALL_SEASONS, colors: ['siyah', 'bordo', 'bej'] },
  { sub: 'ince triko', category: 'top', style: 'smart-casual', formality: 3, warmth: 3, material: 'triko', pattern: 'düz', fit: 'dar', layerRole: 'base', seasons: MID, colors: ['bej', 'lacivert', 'yeşil'] },
  { sub: 'çizgili tişört', category: 'top', style: 'casual', formality: 2, warmth: 2, material: 'pamuk', pattern: 'çizgili', fit: 'normal', layerRole: 'base', seasons: WARM, colors: ['lacivert', 'kırmızı'] },
  { sub: 'oversize sweatshirt', category: 'top', style: 'streetwear', formality: 2, warmth: 4, material: 'pamuk', pattern: 'grafik', fit: 'oversize', layerRole: 'base', seasons: COLD, colors: ['gri', 'siyah', 'yeşil'] },
  { sub: 'teknik spor tişört', category: 'top', style: 'sport', formality: 1, warmth: 1, material: 'polyester', pattern: 'düz', fit: 'dar', layerRole: 'base', seasons: ALL_SEASONS, colors: ['siyah', 'mavi'] },
  { sub: 'keten gömlek', category: 'top', style: 'casual', formality: 2, warmth: 1, material: 'keten', pattern: 'düz', fit: 'bol', layerRole: 'mid', seasons: ['yaz'], colors: ['beyaz', 'bej', 'mavi'] },
  // Alt
  { sub: 'koyu jean', category: 'bottom', style: 'casual', formality: 2, warmth: 3, material: 'denim', pattern: 'düz', fit: 'normal', seasons: ALL_SEASONS, colors: ['lacivert', 'siyah'] },
  { sub: 'kumaş pantolon', category: 'bottom', style: 'formal', formality: 4, warmth: 3, material: 'yün karışım', pattern: 'düz', fit: 'normal', seasons: ALL_SEASONS, colors: ['siyah', 'gri', 'lacivert'] },
  { sub: 'chino pantolon', category: 'bottom', style: 'smart-casual', formality: 3, warmth: 3, material: 'pamuk', pattern: 'düz', fit: 'normal', seasons: ALL_SEASONS, colors: ['bej', 'haki', 'lacivert'] },
  { sub: 'eşofman altı', category: 'bottom', style: 'sport', formality: 1, warmth: 3, material: 'pamuk', pattern: 'düz', fit: 'bol', seasons: ALL_SEASONS, colors: ['gri', 'siyah'] },
  { sub: 'şort', category: 'bottom', style: 'casual', formality: 1, warmth: 1, material: 'pamuk', pattern: 'düz', fit: 'normal', seasons: ['yaz'], colors: ['bej', 'lacivert'] },
  { sub: 'cargo pantolon', category: 'bottom', style: 'streetwear', formality: 2, warmth: 3, material: 'pamuk', pattern: 'düz', fit: 'bol', seasons: ALL_SEASONS, colors: ['haki', 'siyah'] },
  { sub: 'midi etek', category: 'bottom', style: 'elegant', formality: 3, warmth: 2, material: 'viskon', pattern: 'düz', fit: 'normal', seasons: WARM, colors: ['siyah', 'bej', 'pembe'] },
  // Tek parça
  { sub: 'midi elbise', category: 'onepiece', style: 'elegant', formality: 4, warmth: 2, material: 'krep', pattern: 'düz', fit: 'normal', layerRole: 'base', seasons: ALL_SEASONS, colors: ['siyah', 'lacivert', 'bordo'] },
  { sub: 'çiçekli yazlık elbise', category: 'onepiece', style: 'bohemian', formality: 2, warmth: 1, material: 'viskon', pattern: 'çiçekli', fit: 'bol', layerRole: 'base', seasons: ['yaz'], colors: ['çok renkli'] },
  // Dış giyim
  { sub: 'yün kaban', category: 'outerwear', style: 'classic', formality: 4, warmth: 5, material: 'yün', pattern: 'düz', fit: 'normal', layerRole: 'outer', waterResistant: false, seasons: ['kış'], colors: ['lacivert', 'bej', 'siyah'] },
  { sub: 'trençkot', category: 'outerwear', style: 'classic', formality: 4, warmth: 3, material: 'gabardin', pattern: 'düz', fit: 'normal', layerRole: 'outer', waterResistant: true, seasons: MID, colors: ['bej'] },
  { sub: 'deri ceket', category: 'outerwear', style: 'casual', formality: 3, warmth: 3, material: 'deri', pattern: 'düz', fit: 'dar', layerRole: 'outer', waterResistant: true, seasons: MID, colors: ['siyah', 'kahverengi'] },
  { sub: 'şişme mont', category: 'outerwear', style: 'casual', formality: 2, warmth: 5, material: 'naylon', pattern: 'düz', fit: 'normal', layerRole: 'outer', waterResistant: true, seasons: ['kış'], colors: ['siyah', 'haki'] },
  { sub: 'blazer ceket', category: 'outerwear', style: 'smart-casual', formality: 4, warmth: 2, material: 'yün karışım', pattern: 'düz', fit: 'normal', layerRole: 'outer', waterResistant: false, seasons: ALL_SEASONS, colors: ['lacivert', 'bej', 'gri'] },
  { sub: 'rüzgarlık', category: 'outerwear', style: 'sport', formality: 1, warmth: 2, material: 'polyester', pattern: 'düz', fit: 'normal', layerRole: 'outer', waterResistant: true, seasons: MID, colors: ['siyah'] },
  // Ayakkabı
  { sub: 'beyaz sneaker', category: 'shoes', style: 'casual', formality: 2, warmth: 2, material: 'deri', waterResistant: false, seasons: ALL_SEASONS, colors: ['beyaz'] },
  { sub: 'loafer', category: 'shoes', style: 'classic', formality: 4, warmth: 2, material: 'deri', waterResistant: false, seasons: ALL_SEASONS, colors: ['kahverengi', 'siyah'] },
  { sub: 'deri bot', category: 'shoes', style: 'casual', formality: 3, warmth: 4, material: 'deri', waterResistant: true, seasons: COLD, colors: ['siyah', 'kahverengi'] },
  { sub: 'koşu ayakkabısı', category: 'shoes', style: 'sport', formality: 1, warmth: 2, material: 'file', waterResistant: false, seasons: ALL_SEASONS, colors: ['gri'] },
  { sub: 'sandalet', category: 'shoes', style: 'casual', formality: 1, warmth: 1, material: 'deri', waterResistant: false, seasons: ['yaz'], colors: ['kahverengi'] },
  { sub: 'oxford ayakkabı', category: 'shoes', style: 'formal', formality: 5, warmth: 2, material: 'deri', waterResistant: false, seasons: ALL_SEASONS, colors: ['siyah'] },
  // Aksesuar
  { sub: 'deri kemer', category: 'accessory', style: 'classic', formality: 3, warmth: 1, material: 'deri', seasons: ALL_SEASONS, colors: ['kahverengi', 'siyah'] },
  { sub: 'atkı', category: 'accessory', style: 'casual', formality: 2, warmth: 4, material: 'yün', seasons: ['kış'], colors: ['gri'] },
];

export function makeItem(template: Template, color: ColorFamily, index: number) {
  return {
    id: `item_${String(index).padStart(3, '0')}`,
    name: `${color} ${template.sub}`,
    category: template.category,
    subCategory: template.sub,
    color,
    colorFamily: color,
    colorHex: COLOR_FAMILY_HEX[color],
    secondaryColors: [],
    material: template.material,
    style: template.style,
    pattern: template.pattern ?? 'düz',
    fit: template.fit ?? 'normal',
    formality: template.formality,
    warmth: template.warmth,
    waterResistant: template.waterResistant ?? false,
    layerRole: template.layerRole ?? 'none',
    seasons: template.seasons,
    weatherMatch: [],
    imagePath: `https://res.cloudinary.com/testcloud/image/upload/v1/digital_wardrobe/u/${index}.jpg`,
    attributes: {},
    aiAnalyzed: true,
    wearCount: 0,
  };
}

/** size: kaç renk varyantı kullanılacağı (1 = küçük, 2 = orta, 4 = büyük). */
export function buildWardrobe(variants: number) {
  const items: any[] = [];
  let index = 1;
  for (const template of TEMPLATES) {
    for (const color of template.colors.slice(0, variants)) {
      items.push(makeItem(template, color, index++));
    }
  }
  // Büyük gardırop: aynı şablonların tekrarları (farklı kimlik) ile ölçek testi
  if (variants >= 4) {
    const copies = items.slice(0, 60).map((item, i) => ({ ...item, id: `item_x${String(i).padStart(3, '0')}`, name: `${item.name} (2)` }));
    items.push(...copies);
  }
  return items;
}

export const WARDROBES = {
  kucuk: buildWardrobe(1),
  orta: buildWardrobe(2),
  buyuk: buildWardrobe(4),
};

export function weather(overrides: Partial<WeatherSnapshot>): WeatherSnapshot {
  return {
    locationLabel: 'Test',
    latitude: 41,
    longitude: 29,
    time: '2026-11-10T09:00',
    isForecast: false,
    temperatureC: 15,
    feelsLikeC: 15,
    minC: 10,
    maxC: 18,
    precipitationProbability: 10,
    weatherCode: 1,
    condition: 'Çoğunlukla açık',
    windKmh: 10,
    ...overrides,
  };
}

export interface Scenario {
  id: string;
  label: string;
  request: StylistRequest;
  weather: WeatherSnapshot | null;
  date: string;
}

export const SCENARIOS: Scenario[] = [
  { id: 'ofis_yagmur', label: 'Ofis, 12°C yağmurlu', date: '2026-11-10T09:00',
    request: { event: 'Ofis', dressiness: 3 }, weather: weather({ temperatureC: 12, feelsLikeC: 10, weatherCode: 61, condition: 'Hafif yağmur', precipitationProbability: 80 }) },
  { id: 'gorusme_kar', label: 'İş görüşmesi, 2°C karlı', date: '2026-12-15T10:00',
    request: { event: 'İş Görüşmesi', dressiness: 4 }, weather: weather({ temperatureC: 2, feelsLikeC: -1, weatherCode: 73, condition: 'Orta şiddetli kar', precipitationProbability: 90 }) },
  { id: 'gundelik_sicak', label: 'Gündelik, 30°C açık', date: '2026-07-20T14:00',
    request: { event: 'Gündelik', dressiness: 2 }, weather: weather({ temperatureC: 31, feelsLikeC: 33, weatherCode: 0, condition: 'Açık', precipitationProbability: 0, time: '2026-07-20T14:00' }) },
  { id: 'spor_soguk_ofis_kimligi', label: 'Spor, -3°C kar, "ofiste çalışırım" stil kimliği', date: '2026-01-10T08:00',
    request: { event: 'Spor', personalContext: 'Ofiste çalışıyorum, genelde rahat ve şık giyinirim.' },
    weather: weather({ temperatureC: -3, feelsLikeC: -7, weatherCode: 71, condition: 'Hafif kar', precipitationProbability: 70, time: '2026-01-10T08:00' }) },
  { id: 'randevu_ilik', label: 'Randevu, 18°C parçalı bulutlu', date: '2026-05-05T20:00',
    request: { event: 'Randevu', dressiness: 3, mood: 'Romantik' }, weather: weather({ temperatureC: 19, feelsLikeC: 18, weatherCode: 2, condition: 'Parçalı bulutlu', time: '2026-05-05T20:00' }) },
  { id: 'dugun_gunduz', label: 'Düğün, 24°C açık', date: '2026-06-14T15:00',
    request: { event: 'Düğün/Davet', dressiness: 5 }, weather: weather({ temperatureC: 25, feelsLikeC: 24, weatherCode: 0, condition: 'Açık', time: '2026-06-14T15:00' }) },
  { id: 'parti_serin', label: 'Parti, 14°C kapalı', date: '2026-10-20T22:00',
    request: { event: 'Parti', dressiness: 4 }, weather: weather({ temperatureC: 14, feelsLikeC: 13, weatherCode: 3, condition: 'Kapalı', time: '2026-10-20T22:00' }) },
  { id: 'seyahat_saganak', label: 'Seyahat, 20°C sağanak', date: '2026-09-25T09:00',
    request: { event: 'Seyahat', activity: 3 }, weather: weather({ temperatureC: 20, feelsLikeC: 20, weatherCode: 80, condition: 'Hafif sağanak yağış', precipitationProbability: 70, time: '2026-09-25T09:00' }) },
  { id: 'okul_soguk', label: 'Okul, 8°C bulutlu', date: '2026-03-02T08:00',
    request: { event: 'Okul' }, weather: weather({ temperatureC: 8, feelsLikeC: 6, weatherCode: 3, condition: 'Kapalı', time: '2026-03-02T08:00' }) },
  { id: 'minimal_kapali_mekan', label: 'Gündelik, hava yok sayılıyor, Minimalist + Monokromatik', date: '2026-04-01T12:00',
    request: { event: 'Gündelik', ignoreWeather: true, styleTags: ['Minimalist', 'Monokromatik'] }, weather: null },
];
