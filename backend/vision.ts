import { MediaResolution } from '@google/genai';
import pngjs from 'pngjs';
import {
  CATEGORIES, COLOR_FAMILIES, FITS, LAYER_ROLES, PATTERNS, SEASONS, STYLES, UNKNOWN,
  colorFamilyFromName, deriveWeatherMatch, isValidHex, missingFields,
} from '../shared/wardrobe.js';
import { AiError, generateJson } from './ai/gemini.js';
import { cloudinary, downloadOwnImage, getPublicIdFromUrl, withTransformation } from './cloudinary.js';

const { PNG } = pngjs;

export interface VisionAnalysis {
  isClothing: boolean;
  name: string;
  category: string;
  subCategory: string;
  color: string;
  colorFamily: string;
  colorHex: string | null;
  secondaryColors: string[];
  material: string;
  pattern: string;
  fit: string;
  style: string;
  formality: number;
  warmth: number;
  waterResistant: boolean;
  layerRole: string;
  seasons: string[];
}

const COLOR_FAMILY_OPTIONS = COLOR_FAMILIES as readonly string[];

export const VISION_SCHEMA = {
  type: 'object',
  properties: {
    isClothing: { type: 'boolean' },
    name: { type: 'string' },
    category: { type: 'string', enum: [...CATEGORIES] },
    subCategory: { type: 'string' },
    color: { type: 'string' },
    colorFamily: { type: 'string', enum: [...COLOR_FAMILIES] },
    colorHex: { type: 'string' },
    secondaryColors: { type: 'array', maxItems: 3, items: { type: 'string', enum: [...COLOR_FAMILIES] } },
    material: { type: 'string' },
    pattern: { type: 'string', enum: [...PATTERNS] },
    fit: { type: 'string', enum: [...FITS] },
    style: { type: 'string', enum: [...STYLES] },
    formality: { type: 'integer', minimum: 1, maximum: 5 },
    warmth: { type: 'integer', minimum: 1, maximum: 5 },
    waterResistant: { type: 'boolean' },
    layerRole: { type: 'string', enum: [...LAYER_ROLES] },
    seasons: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'string', enum: [...SEASONS] } },
  },
  required: [
    'isClothing', 'name', 'category', 'subCategory', 'color', 'colorFamily', 'colorHex', 'secondaryColors',
    'material', 'pattern', 'fit', 'style', 'formality', 'warmth', 'waterResistant', 'layerRole', 'seasons',
  ],
};

const VISION_PROMPT = `Bu fotoğraftaki ana kıyafet veya aksesuarı analiz et. Fotoğrafta kıyafet, ayakkabı, aksesuar veya makyaj ürünü yoksa isClothing=false yap.

Alanlar:
- name: kısa Türkçe ad (ör. "Lacivert slim fit gömlek")
- category: top (tişört, gömlek, bluz, kazak, sweatshirt), bottom (pantolon, jean, etek, şort), onepiece (elbise, tulum), outerwear (mont, kaban, ceket, blazer, trençkot, yağmurluk), shoes, accessory (çanta, kemer, şapka, takı, atkı), makeup
- subCategory: Türkçe tür adı (ör. "gömlek", "kot pantolon", "chelsea bot")
- color: Türkçe renk adı (ör. "açık mavi"); colorFamily: listedeki en yakın renk ailesi; colorHex: baskın rengin #RRGGBB kodu; secondaryColors: belirgin ikincil renk aileleri (yoksa boş liste)
- material: Türkçe kumaş/malzeme (ör. "pamuk", "yün", "deri"); anlaşılmıyorsa "belirsiz"
- pattern, fit: listeden; kıyafet olmayan ürünlerde veya anlaşılmıyorsa "belirsiz"
- style: listeden en yakın stil
- formality: 1 (spor/ev) … 3 (smart casual) … 5 (resmi/gece)
- warmth: 1 (çok ince, yazlık) … 3 (orta) … 5 (çok kalın, kışlık)
- waterResistant: yağmurda ıslanmayı önleyen bir malzeme mi (deri, naylon, su geçirmez kumaş)
- layerRole: base (tek başına/iç kat), mid (gömlek, hırka gibi başka bir şeyin üstüne giyilebilen), outer (dış katman), none (ayakkabı, aksesuar, makyaj)
- seasons: uygun olduğu mevsimler

Emin olmadığın metin alanlarında "belirsiz" kullan; görmediğin bir özelliği uydurma.`;

const pick = <T extends string>(value: unknown, options: readonly T[], fallback: T): T =>
  (typeof value === 'string' && (options as readonly string[]).includes(value) ? value as T : fallback);

const scale = (value: unknown, fallback: number) =>
  (typeof value === 'number' && Number.isFinite(value) ? Math.min(5, Math.max(1, Math.round(value))) : fallback);

const text = (value: unknown, max: number, fallback = '') =>
  (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : fallback);

/** Model çıktısını izinli değerlere ve sınırlara çeker (şema olsa da uygulamada doğrulanır). */
export function normalizeVisionOutput(raw: any): VisionAnalysis {
  const category = pick(raw?.category, CATEGORIES, 'top');
  const color = text(raw?.color, 40);
  let colorFamily: string = pick(raw?.colorFamily, COLOR_FAMILY_OPTIONS, '' as any);
  if (!colorFamily) colorFamily = colorFamilyFromName(color) || 'gri';
  const garment = ['top', 'bottom', 'onepiece', 'outerwear'].includes(category);
  return {
    isClothing: raw?.isClothing !== false,
    name: text(raw?.name, 80, 'Yeni parça'),
    category,
    subCategory: text(raw?.subCategory, 60, UNKNOWN),
    color: color || colorFamily,
    colorFamily,
    colorHex: isValidHex(raw?.colorHex) ? raw.colorHex.toUpperCase() : null,
    secondaryColors: Array.isArray(raw?.secondaryColors)
      ? Array.from(new Set(raw.secondaryColors.filter((c: unknown) => typeof c === 'string' && COLOR_FAMILY_OPTIONS.includes(c) && c !== colorFamily))).slice(0, 3) as string[]
      : [],
    material: text(raw?.material, 60, UNKNOWN),
    pattern: garment ? pick(raw?.pattern, PATTERNS, UNKNOWN) : UNKNOWN,
    fit: garment ? pick(raw?.fit, FITS, UNKNOWN) : UNKNOWN,
    style: pick(raw?.style, STYLES, 'casual'),
    formality: scale(raw?.formality, 2),
    warmth: scale(raw?.warmth, 3),
    waterResistant: raw?.waterResistant === true,
    layerRole: category === 'outerwear' ? 'outer'
      : ['shoes', 'accessory', 'makeup'].includes(category) ? 'none'
      : pick(raw?.layerRole, LAYER_ROLES, 'base'),
    seasons: Array.isArray(raw?.seasons)
      ? Array.from(new Set(raw.seasons.filter((s: unknown) => typeof s === 'string' && (SEASONS as readonly string[]).includes(s)))) as string[]
      : [],
  };
}

/** Kıyafet fotoğrafını Gemini ile etiketler. Hata durumunda AiError fırlatır. */
export async function analyzeClothingImage(base64: string, mimeType: string): Promise<{ analysis: VisionAnalysis; model: string }> {
  const { data, info } = await generateJson<any>({
    task: 'vision',
    label: 'vision_tag',
    contents: [{ inlineData: { mimeType, data: base64 } }, { text: VISION_PROMPT }],
    schema: VISION_SCHEMA,
    mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
  });
  return { analysis: normalizeVisionOutput(data), model: info.model };
}

const ANALYSIS_FIELDS = [
  'subCategory', 'color', 'colorFamily', 'colorHex', 'secondaryColors', 'material', 'pattern', 'fit',
  'style', 'formality', 'warmth', 'waterResistant', 'layerRole', 'seasons',
] as const;

const isEmptyValue = (value: unknown) =>
  value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);

/**
 * Analizi parçaya uygular. Varsayılan olarak yalnızca boş alanlar doldurulur;
 * kullanıcının seçtiği kategori ve adı hiçbir zaman değiştirilmez.
 */
export function applyAnalysisToItem(doc: any, analysis: VisionAnalysis, options: { overwrite?: boolean } = {}) {
  if (isEmptyValue(doc.name)) doc.name = analysis.name;
  if (isEmptyValue(doc.category)) doc.category = analysis.category;
  for (const field of ANALYSIS_FIELDS) {
    if (options.overwrite || isEmptyValue(doc[field])) doc[field] = (analysis as any)[field];
  }
  doc.weatherMatch = deriveWeatherMatch(doc);
  doc.aiAnalyzed = true;
}

export function itemNeedsEnrichment(doc: any): boolean {
  return missingFields(doc).length > 0;
}

// ─── Arka plan kaldırma (Gemini 2.5 Flash segmentasyonu, ücretsiz) ────────────
interface SegmentationMask {
  box_2d: number[];
  mask: string;
  label: string;
}

const SEGMENTATION_SCHEMA = {
  type: 'object',
  properties: {
    masks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          box_2d: { type: 'array', minItems: 4, maxItems: 4, items: { type: 'integer' } },
          mask: { type: 'string' },
          label: { type: 'string' },
        },
        required: ['box_2d', 'mask', 'label'],
      },
    },
  },
  required: ['masks'],
};

function sampleMask(mask: { width: number; height: number; data: Buffer }, u: number, v: number): number {
  const x = Math.min(mask.width - 1, Math.max(0, u * (mask.width - 1)));
  const y = Math.min(mask.height - 1, Math.max(0, v * (mask.height - 1)));
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(mask.width - 1, x0 + 1), y1 = Math.min(mask.height - 1, y0 + 1);
  const fx = x - x0, fy = y - y0;
  const at = (xx: number, yy: number) => mask.data[(yy * mask.width + xx) * 4];
  const top = at(x0, y0) * (1 - fx) + at(x1, y0) * fx;
  const bottom = at(x0, y1) * (1 - fx) + at(x1, y1) * fx;
  return top * (1 - fy) + bottom * fy;
}

/**
 * Görsel ve Gemini maskesinden şeffaf arka planlı, parçaya kırpılmış PNG üretir (saf fonksiyon).
 * box: [y0, x0, y1, x1] 0-1000 aralığında normalize.
 */
export function composeCutout(imagePng: Buffer, maskPng: Buffer, box: number[]): Buffer {
  const image = PNG.sync.read(imagePng);
  const mask = PNG.sync.read(maskPng);
  const [ny0, nx0, ny1, nx1] = box.map(v => Math.min(1000, Math.max(0, v)) / 1000);
  const bx0 = Math.floor(nx0 * image.width), by0 = Math.floor(ny0 * image.height);
  const bx1 = Math.ceil(nx1 * image.width), by1 = Math.ceil(ny1 * image.height);
  const boxW = Math.max(1, bx1 - bx0), boxH = Math.max(1, by1 - by0);

  const pad = Math.round(Math.max(boxW, boxH) * 0.04);
  const cx0 = Math.max(0, bx0 - pad), cy0 = Math.max(0, by0 - pad);
  const cx1 = Math.min(image.width, bx1 + pad), cy1 = Math.min(image.height, by1 + pad);
  const out = new PNG({ width: cx1 - cx0, height: cy1 - cy0 });

  for (let y = cy0; y < cy1; y++) {
    for (let x = cx0; x < cx1; x++) {
      const src = (y * image.width + x) * 4;
      const dst = ((y - cy0) * out.width + (x - cx0)) * 4;
      out.data[dst] = image.data[src];
      out.data[dst + 1] = image.data[src + 1];
      out.data[dst + 2] = image.data[src + 2];
      let alpha = 0;
      if (x >= bx0 && x < bx1 && y >= by0 && y < by1) {
        const probability = sampleMask(mask, (x - bx0) / boxW, (y - by0) / boxH);
        // Yumuşak kenar: 96 altı şeffaf, 160 üstü tam opak
        alpha = Math.max(0, Math.min(255, Math.round((probability - 96) * 255 / 64)));
      }
      out.data[dst + 3] = Math.round(alpha * (image.data[src + 3] / 255));
    }
  }
  return PNG.sync.write(out);
}

/** Parçanın arka planı kaldırılmış kopyasını üretip Cloudinary'ye yükler ve adresini döndürür. */
export async function createCutout(item: any, userId: string): Promise<string> {
  const source = await downloadOwnImage(withTransformation(item.imagePath, 'f_png,w_768'));
  if (!source) throw new AiError('bad_request', 'Parça görseli indirilemedi.');

  const { data } = await generateJson<{ masks: SegmentationMask[] }>({
    task: 'segmentation',
    label: 'cutout_mask',
    contents: [
      { inlineData: { mimeType: 'image/png', data: source.base64 } },
      { text: 'Fotoğraftaki ana kıyafet veya aksesuarın segmentasyon maskesini ver. Her giriş için "box_2d" ([y0, x0, y1, x1], 0-1000 aralığında), "mask" (base64 PNG olasılık haritası) ve "label" alanlarını döndür. Arka planı, askıyı, mankeni veya kişiyi dahil etme.' },
    ],
    schema: SEGMENTATION_SCHEMA,
  });

  const masks = (data?.masks || []).filter(m => Array.isArray(m.box_2d) && m.box_2d.length === 4 && typeof m.mask === 'string');
  if (masks.length === 0) throw new AiError('invalid_output', 'Parça görselde ayırt edilemedi.');
  const area = (m: SegmentationMask) => Math.max(0, m.box_2d[2] - m.box_2d[0]) * Math.max(0, m.box_2d[3] - m.box_2d[1]);
  const main = masks.sort((a, b) => area(b) - area(a))[0];
  const maskBase64 = main.mask.replace(/^data:image\/png;base64,/, '');

  let cutout: Buffer;
  try {
    cutout = composeCutout(source.buffer, Buffer.from(maskBase64, 'base64'), main.box_2d);
  } catch {
    throw new AiError('invalid_output', 'Maske işlenemedi.');
  }

  const publicId = getPublicIdFromUrl(item.imagePath);
  const baseName = publicId ? publicId.split('/').pop() : `item_${Date.now()}`;
  const uploaded = await cloudinary.uploader.upload(`data:image/png;base64,${cutout.toString('base64')}`, {
    folder: `digital_wardrobe/${userId}`,
    public_id: `${baseName}_cutout`,
    overwrite: true,
    format: 'png',
  });
  return uploaded.secure_url;
}
