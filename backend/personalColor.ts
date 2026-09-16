import { MediaResolution } from '@google/genai';
import { COLOR_FAMILIES, FITS, SEASONS } from '../shared/wardrobe.js';
import type { PersonalColorResult, StyleProfile } from '../shared/api.js';
import { AiError, generateJson } from './ai/gemini.js';
import { RequestError } from './engine/request.js';
import { hasConsent, preferenceSummary } from './preferences.js';

export const UNDERTONES = ['sıcak', 'soğuk', 'nötr'] as const;
export const CONTRASTS = ['düşük', 'orta', 'yüksek'] as const;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
/** ~4 MB görsel */
export const MAX_SELFIE_BASE64 = 5_600_000;

const SCHEMA = {
  type: 'object',
  properties: {
    faceVisible: { type: 'boolean' },
    season: { type: 'string', enum: [...SEASONS] },
    undertone: { type: 'string', enum: [...UNDERTONES] },
    contrast: { type: 'string', enum: [...CONTRASTS] },
    bestColorFamilies: { type: 'array', minItems: 3, maxItems: 6, items: { type: 'string', enum: [...COLOR_FAMILIES] } },
    avoidColorFamilies: { type: 'array', maxItems: 4, items: { type: 'string', enum: [...COLOR_FAMILIES] } },
    note: { type: 'string' },
  },
  required: ['faceVisible', 'season', 'undertone', 'contrast', 'bestColorFamilies', 'avoidColorFamilies', 'note'],
};

const PROMPT = `Bu fotoğraf kişinin kıyafet renk seçimine yardımcı olmak için gönderildi. Mevsimsel renk analizi yap.

- faceVisible: yüz doğal ışıkta ve net görünüyor mu (yüz yoksa veya çok karanlık/filtreliyse false)
- undertone: cilt alt tonu (sıcak, soğuk, nötr); contrast: saç, göz ve cilt arasındaki kontrast düzeyi
- season: bu özelliklere en uygun renk mevsimi (ilkbahar, yaz, sonbahar, kış)
- bestColorFamilies: yüze yakın giyildiğinde en iyi duran 3-6 renk ailesi; avoidColorFamilies: yüze yakın giyildiğinde soluk gösterebilecek en fazla 4 renk ailesi (iki listede aynı renk olmasın)
- note: sonucu 2 kısa Türkçe cümleyle, nazik ve yargılamayan bir dille açıkla

Kişinin görünüşü, yaşı, kilosu, etnik kökeni veya güzelliği hakkında yorum yapma; yalnızca renk uyumundan bahset. Emin değilsen nötr alt ton ve orta kontrast seç.`;

export function sanitizeSelfie(raw: any): { base64: string; mimeType: string } {
  const mimeType = raw?.mimeType;
  let base64 = raw?.base64;
  if (typeof base64 !== 'string' || typeof mimeType !== 'string' || !ALLOWED_MIME.includes(mimeType)) {
    throw new RequestError('JPEG, PNG veya WEBP biçiminde bir fotoğraf gönder.');
  }
  base64 = base64.replace(/^data:image\/[a-z]+;base64,/, '');
  if (base64.length < 100 || base64.length > MAX_SELFIE_BASE64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new RequestError('Fotoğraf okunamadı veya çok büyük (en fazla 4 MB).');
  }
  return { base64, mimeType };
}

/** Model çıktısını izinli değerlere çeker; iki listede birden olan renkler "kaçın" listesinden çıkarılır. */
export function normalizePersonalColor(raw: any, now = new Date()): PersonalColorResult {
  const pick = <T extends string>(value: unknown, options: readonly T[], fallback: T): T =>
    (typeof value === 'string' && (options as readonly string[]).includes(value) ? value as T : fallback);
  const families = (value: unknown, max: number) => Array.isArray(value)
    ? Array.from(new Set(value.filter((v): v is string => typeof v === 'string' && (COLOR_FAMILIES as readonly string[]).includes(v)))).slice(0, max)
    : [];
  const best = families(raw?.bestColorFamilies, 6);
  const avoid = families(raw?.avoidColorFamilies, 4).filter(c => !best.includes(c));
  return {
    season: pick(raw?.season, SEASONS, 'sonbahar'),
    undertone: pick(raw?.undertone, UNDERTONES, 'nötr'),
    contrast: pick(raw?.contrast, CONTRASTS, 'orta'),
    bestColorFamilies: best,
    avoidColorFamilies: avoid,
    note: typeof raw?.note === 'string' ? raw.note.trim().slice(0, 400) : '',
    analyzedAt: now.toISOString(),
  };
}

/** Yüz fotoğrafından kişisel renk paleti çıkarır. Fotoğraf hiçbir yere kaydedilmez. */
export async function analyzePersonalColor(image: { base64: string; mimeType: string }): Promise<PersonalColorResult> {
  const { data } = await generateJson<any>({
    task: 'vision',
    label: 'personal_color',
    contents: [{ inlineData: { mimeType: image.mimeType, data: image.base64 } }, { text: PROMPT }],
    schema: SCHEMA,
    mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
  });
  if (data?.faceVisible === false) {
    throw new AiError('bad_request', 'Fotoğrafta yüz net görünmüyor. Gün ışığında, filtresiz bir fotoğraf dene.');
  }
  const result = normalizePersonalColor(data);
  if (result.bestColorFamilies.length === 0) throw new AiError('invalid_output', 'Renk analizi tamamlanamadı.');
  return result;
}

// ─── Stil profili ──────────────────────────────────────────────────────────
export interface StyleProfileUpdate {
  preferredFits?: string[];
  avoidFits?: string[];
  dislikedColorFamilies?: string[];
  notes?: string;
}

export function sanitizeStyleProfile(raw: any): StyleProfileUpdate {
  if (!raw || typeof raw !== 'object') throw new RequestError('Stil profili eksik.');
  const update: StyleProfileUpdate = {};
  const list = (field: 'preferredFits' | 'avoidFits' | 'dislikedColorFamilies', options: readonly string[], max: number) => {
    const value = raw[field];
    if (value === undefined) return;
    if (!Array.isArray(value) || value.length > max || !value.every(v => typeof v === 'string' && options.includes(v))) {
      throw new RequestError(`Geçersiz alan: ${field}`);
    }
    update[field] = Array.from(new Set(value));
  };
  const fits = FITS.filter(f => f !== 'belirsiz');
  list('preferredFits', fits, fits.length);
  list('avoidFits', fits, fits.length);
  list('dislikedColorFamilies', COLOR_FAMILIES, COLOR_FAMILIES.length);
  if (update.preferredFits && update.avoidFits && update.preferredFits.some(f => update.avoidFits!.includes(f))) {
    throw new RequestError('Bir kesim hem tercih edilen hem kaçınılan olamaz.');
  }
  if (raw.notes !== undefined) {
    if (typeof raw.notes !== 'string' || raw.notes.length > 1000) throw new RequestError('Geçersiz alan: notes');
    update.notes = raw.notes.trim();
  }
  return update;
}

export async function toStyleProfileDTO(userDoc: any): Promise<StyleProfile> {
  // Mongoose belgesinin alt belgeleri yayılınca (...) iç alanlar gelir; düz nesneyle çalışılır
  const user = typeof userDoc?.toObject === 'function' ? userDoc.toObject() : userDoc;
  const sp = user?.styleProfile || {};
  const pc = hasConsent(user, 'personalColor') && sp.personalColor?.analyzedAt ? sp.personalColor : null;
  return {
    preferredFits: sp.preferredFits || [],
    avoidFits: sp.avoidFits || [],
    dislikedColorFamilies: sp.dislikedColorFamilies || [],
    notes: sp.notes || '',
    personalColor: pc ? { ...pc, analyzedAt: new Date(pc.analyzedAt).toISOString() } : null,
    preferenceSummary: await preferenceSummary(user),
  };
}
