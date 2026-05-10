// Tüm bileşenler tarafından paylaşılan sabit veriler
export const CATEGORIES = ['top', 'bottom', 'outerwear', 'shoes', 'makeup', 'accessory'] as const;
export const CATEGORY_LABELS: Record<string, string> = {
  all: 'Tümü',
  top: 'Üst',
  bottom: 'Alt',
  outerwear: 'Dış Giyim',
  shoes: 'Ayakkabı',
  makeup: 'Makyaj',
  accessory: 'Aksesuar',
};

export const STYLES = ['casual', 'formal', 'sport', 'elegant', 'bohemian'] as const;
export const WEATHERS = ['sunny', 'cloudy', 'rainy', 'snowy', 'hot', 'cold'] as const;

export const EVENTS = ['Gündelik', 'İş Görüşmesi', 'Randevu', 'Parti', 'Düğün/Davet', 'Spor'];
export const MOODS  = ['Enerjik', 'Minimalist', 'Romantik', 'Ciddi', 'Rahat'];

export const OUTFIT_CATEGORY_LABELS: Record<string, string> = {
  top: 'Üst Giyim',
  bottom: 'Alt Giyim',
  outerwear: 'Dış Giyim',
  shoes: 'Ayakkabı',
  accessory: 'Aksesuar',
  makeup: 'Makyaj',
};

// Renk uyumu, stil karakteri ve kesim tercihlerine göre gruplanmış stil etiketleri
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

export const PATTERNS = [
  { value: '', label: 'Belirtilmedi' },
  { value: 'düz', label: 'Düz' },
  { value: 'çizgili', label: 'Çizgili' },
  { value: 'kareli', label: 'Kareli' },
  { value: 'çiçekli', label: 'Çiçekli' },
  { value: 'grafik', label: 'Grafik / Baskı' },
  { value: 'noktalı', label: 'Noktalı' },
  { value: 'hayvan', label: 'Hayvan Deseni' },
  { value: 'kamuflaj', label: 'Kamuflaj' },
  { value: 'batik', label: 'Batik / Tie-dye' },
];

export const FITS = [
  { value: '', label: 'Belirtilmedi' },
  { value: 'dar', label: 'Dar / Slim' },
  { value: 'normal', label: 'Normal / Regular' },
  { value: 'bol', label: 'Bol / Loose' },
  { value: 'oversize', label: 'Oversize' },
  { value: 'crop', label: 'Crop' },
];
