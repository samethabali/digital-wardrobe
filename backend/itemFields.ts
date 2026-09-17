import {
  CATEGORIES, COLOR_FAMILIES, FITS, LAYER_ROLES, PATTERNS, SEASONS, STYLES, WEATHERS,
  deriveWeatherMatch, isValidHex,
} from '../shared/wardrobe.js';

// ─── Güncelleme alanı beyaz listeleri ──────────────────────────────────────
// İstemciden gelen gövde asla doğrudan veritabanına verilmez. userId, imagePath, id, aiAnalyzed, embedding gibi
// alanlar yalnızca sunucu tarafından yazılır; aksi halde kayıt başka kullanıcıya taşınabilir ya da
// imagePath üzerinden başka kullanıcının görseli sildirilebilir.
export type UpdatePick = { update: Record<string, unknown> } | { error: string };

function pickStringFields(body: any, fields: Record<string, number>, update: Record<string, unknown>): string | null {
  for (const [field, maxLength] of Object.entries(fields)) {
    const value = body?.[field];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'string' || value.length > maxLength) return `Geçersiz alan: ${field}`;
    update[field] = value;
  }
  return null;
}

function isStringArray(value: unknown, maxItems: number, maxLength: number): value is string[] {
  return Array.isArray(value) && value.length <= maxItems &&
    value.every(v => typeof v === 'string' && v.length <= maxLength);
}

const oneOf = (options: readonly string[], value: unknown) => typeof value === 'string' && options.includes(value);

/** Değişince parçanın embedding'i geçersiz sayılan alanlar (görünüşü/tarifi değiştirenler). */
export const EMBEDDING_FIELDS = ['category', 'subCategory', 'color', 'colorFamily', 'material', 'pattern', 'fit', 'style', 'formality', 'warmth'];

export function pickItemUpdate(body: any): UpdatePick {
  const update: Record<string, unknown> = {};
  const error = pickStringFields(body, { name: 200, subCategory: 100, color: 100, material: 100 }, update);
  if (error) return { error };

  const enums: [string, readonly string[]][] = [
    ['category', CATEGORIES], ['style', STYLES], ['pattern', PATTERNS], ['fit', FITS], ['layerRole', LAYER_ROLES],
  ];
  for (const [field, options] of enums) {
    const value = body?.[field];
    if (value === undefined || value === null) continue;
    // Eski kayıtlar boş desen/kesim tutabilir; boş değer "belirtilmedi" anlamına gelir
    if (value === '' && (field === 'pattern' || field === 'fit')) { update[field] = ''; continue; }
    if (!oneOf(options, value)) return { error: `Geçersiz alan: ${field}` };
    update[field] = value;
  }

  if (body?.colorFamily !== undefined && body?.colorFamily !== null) {
    if (!oneOf(COLOR_FAMILIES, body.colorFamily)) return { error: 'Geçersiz alan: colorFamily' };
    update.colorFamily = body.colorFamily;
  }
  if (body?.colorHex !== undefined) {
    if (body.colorHex !== null && body.colorHex !== '' && !isValidHex(body.colorHex)) return { error: 'Geçersiz alan: colorHex' };
    update.colorHex = body.colorHex || null;
  }
  for (const field of ['formality', 'warmth']) {
    const value = body?.[field];
    if (value === undefined || value === null) continue;
    if (!Number.isInteger(value) || value < 1 || value > 5) return { error: `Geçersiz alan: ${field}` };
    update[field] = value;
  }
  if (body?.waterResistant !== undefined && body?.waterResistant !== null) {
    if (typeof body.waterResistant !== 'boolean') return { error: 'Geçersiz alan: waterResistant' };
    update.waterResistant = body.waterResistant;
  }
  if (body?.price !== undefined) {
    if (body.price !== null && (typeof body.price !== 'number' || !Number.isFinite(body.price) || body.price < 0 || body.price > 1_000_000)) {
      return { error: 'Geçersiz alan: price' };
    }
    update.price = body.price;
  }
  for (const [field, options, max] of [['seasons', SEASONS, 4], ['secondaryColors', COLOR_FAMILIES, 3]] as const) {
    const value = body?.[field];
    if (value === undefined || value === null) continue;
    if (!Array.isArray(value) || value.length > max || !value.every(v => oneOf(options, v))) return { error: `Geçersiz alan: ${field}` };
    update[field] = Array.from(new Set(value));
  }
  if (body?.weatherMatch !== undefined && body?.weatherMatch !== null) {
    if (!isStringArray(body.weatherMatch, 10, 30) || !body.weatherMatch.every(w => oneOf(WEATHERS, w))) return { error: 'Geçersiz alan: weatherMatch' };
    update.weatherMatch = body.weatherMatch;
  }
  return { update };
}

export function pickOutfitUpdate(body: any): UpdatePick {
  const update: Record<string, unknown> = {};
  const error = pickStringFields(body, { name: 200, stylingReason: 2000 }, update);
  if (error) return { error };

  if (body?.items !== undefined && body?.items !== null) {
    if (!isStringArray(body.items, 50, 100)) return { error: 'Geçersiz alan: items' };
    update.items = body.items;
  }
  return { update };
}

/** Yeni kombin kaydı gövdesi (POST /api/outfits). */
export function pickNewOutfit(body: any): { outfit: Record<string, unknown> } | { error: string } {
  const picked = pickOutfitUpdate(body);
  if ('error' in picked) return picked;
  const items = picked.update.items as string[] | undefined;
  if (!items || items.length === 0) return { error: 'Kombinde en az bir parça olmalı.' };
  const score = body?.compatibilityScore;
  if (score !== undefined && score !== null && (typeof score !== 'number' || score < 0 || score > 100)) {
    return { error: 'Geçersiz alan: compatibilityScore' };
  }
  const source = ['ai', 'manual', 'daily', 'trip'].includes(body?.source) ? body.source : 'ai';
  return {
    outfit: {
      name: (picked.update.name as string) || 'Yeni Kombin',
      items,
      stylingReason: (picked.update.stylingReason as string) || '',
      compatibilityScore: typeof score === 'number' ? Math.round(score) : 0,
      source,
    },
  };
}

const sameValue = (a: unknown, b: unknown): boolean => {
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
  }
  // Boş metin, null ve tanımsız "belirtilmedi" anlamında eşdeğer
  const empty = (v: unknown) => v === undefined || v === null || v === '';
  return empty(a) && empty(b) ? true : a === b;
};

/** Gövdeden yalnızca kayıttaki değerden farklı olan alanları bırakır. */
export function changedFields(body: any, current: Record<string, unknown>): Record<string, unknown> {
  if (!body || typeof body !== 'object') return {};
  return Object.fromEntries(Object.entries(body).filter(([key, value]) => !sameValue(value, current[key])));
}

/** Parça güncellemesi embedding'i geçersiz kılıyor mu. */
export function invalidatesEmbedding(update: Record<string, unknown>): boolean {
  return EMBEDDING_FIELDS.some(field => field in update);
}

/** Yeni alanlar değişince eski istemcilerin kullandığı weatherMatch da yeniden türetilir. */
export function withDerivedWeatherMatch(current: any, update: Record<string, unknown>): Record<string, unknown> {
  if ('weatherMatch' in update) return update;
  if (!['warmth', 'waterResistant', 'seasons', 'category'].some(f => f in update)) return update;
  return { ...update, weatherMatch: deriveWeatherMatch({ ...current, ...update }) };
}
