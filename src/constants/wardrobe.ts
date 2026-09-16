// Tüm bileşenler tarafından paylaşılan sabit veriler. Değer listeleri backend ile aynı kaynaktan (shared/wardrobe) gelir.
import {
  CATEGORIES as SHARED_CATEGORIES, CATEGORY_LABELS as SHARED_CATEGORY_LABELS, STYLES as SHARED_STYLES, STYLE_LABELS,
  EVENTS as SHARED_EVENTS, MOODS as SHARED_MOODS, STYLE_TAG_GROUPS as SHARED_STYLE_TAG_GROUPS, WEATHERS as SHARED_WEATHERS,
  PATTERNS as SHARED_PATTERNS, PATTERN_LABELS, FITS as SHARED_FITS, FIT_LABELS, COLOR_FAMILIES, COLOR_FAMILY_HEX,
  SEASONS, SEASON_LABELS, WARMTH_LABELS, FORMALITY_LABELS, FEEDBACK_REASONS, UNKNOWN,
} from '../../shared/wardrobe';

export const CATEGORIES = SHARED_CATEGORIES;
export const CATEGORY_LABELS: Record<string, string> = { all: 'Tümü', ...SHARED_CATEGORY_LABELS };

export const STYLES = SHARED_STYLES;
export { STYLE_LABELS, COLOR_FAMILIES, COLOR_FAMILY_HEX, SEASONS, SEASON_LABELS, WARMTH_LABELS, FORMALITY_LABELS, FEEDBACK_REASONS };

export const WEATHERS = SHARED_WEATHERS;
export const WEATHER_LABELS: Record<string, string> = {
  sunny: 'Güneşli', cloudy: 'Bulutlu', rainy: 'Yağmurlu', snowy: 'Karlı', hot: 'Sıcak', cold: 'Soğuk',
};

export const EVENTS: string[] = [...SHARED_EVENTS];
export const MOODS: string[] = [...SHARED_MOODS];

export const OUTFIT_CATEGORY_LABELS: Record<string, string> = SHARED_CATEGORY_LABELS;

// Renk uyumu, stil karakteri ve kesim tercihlerine göre gruplanmış stil etiketleri
export const STYLE_TAG_GROUPS = SHARED_STYLE_TAG_GROUPS;
export const STYLE_TAGS = STYLE_TAG_GROUPS.flatMap(g => g.tags);

export const PATTERNS = [
  { value: '', label: 'Belirtilmedi' },
  ...SHARED_PATTERNS.filter(p => p !== UNKNOWN).map(value => ({ value, label: PATTERN_LABELS[value] || value })),
  { value: UNKNOWN, label: 'Belirsiz' },
];

export const FITS = [
  { value: '', label: 'Belirtilmedi' },
  ...SHARED_FITS.filter(f => f !== UNKNOWN).map(value => ({ value, label: FIT_LABELS[value] || value })),
  { value: UNKNOWN, label: 'Belirsiz' },
];

/** Puan dökümündeki bileşenlerin arayüz adları (sunucudaki ScoreBreakdown alanları). */
export const SCORE_LABELS: { key: 'weather' | 'formality' | 'color' | 'style' | 'silhouette' | 'preference' | 'variety'; label: string; color: string }[] = [
  { key: 'weather', label: 'Hava Uyumu', color: 'bg-sky-500' },
  { key: 'formality', label: 'Ortam Uyumu', color: 'bg-violet-500' },
  { key: 'color', label: 'Renk Uyumu', color: 'bg-emerald-500' },
  { key: 'style', label: 'Stil Tutarlılığı', color: 'bg-indigo-500' },
  { key: 'silhouette', label: 'Silüet Dengesi', color: 'bg-amber-500' },
  { key: 'preference', label: 'Kişisel Tercih', color: 'bg-fuchsia-500' },
  { key: 'variety', label: 'Çeşitlilik', color: 'bg-teal-500' },
];

/** Parçanın gösterilecek görseli: arka planı kaldırılmış kopya varsa o. */
export const displayImage = (item: { imagePath: string; cutoutImagePath?: string | null }) => item.cutoutImagePath || item.imagePath;
