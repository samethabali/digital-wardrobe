import type { EngineItem } from './items.js';
import type { StyleContext } from './context.js';

export interface Violation {
  code:
    | 'unknown_item' | 'duplicate_item' | 'excluded_item' | 'missing_required'
    | 'structure' | 'too_many' | 'weather_outerwear_missing' | 'weather_outerwear_heavy' | 'weather_shoes';
  message: string;
  itemId?: string;
}

export interface ValidateOptions {
  required?: Iterable<string>;
  excluded?: Iterable<string>;
  ctx?: StyleContext | null;
  /** Kullanıcının gardırobunda uygun dış giyim var mı (yoksa dış giyim eksikliği ihlal sayılmaz) */
  ownsOuterwear?: boolean;
}

const LIMITS: Record<string, number> = { top: 1, bottom: 1, onepiece: 1, outerwear: 1, shoes: 1, accessory: 2, makeup: 1 };

/** Bir kombinin kod tarafından kesin olarak kontrol edilebilen kurallarını denetler. */
export function validateOutfit(itemIds: string[], byId: Map<string, EngineItem>, options: ValidateOptions = {}): Violation[] {
  const violations: Violation[] = [];
  const seen = new Set<string>();
  const items: EngineItem[] = [];

  for (const id of itemIds) {
    if (seen.has(id)) {
      violations.push({ code: 'duplicate_item', message: `Aynı parça birden fazla kez seçilmiş: ${id}`, itemId: id });
      continue;
    }
    seen.add(id);
    const item = byId.get(id);
    if (!item) {
      violations.push({ code: 'unknown_item', message: `Gardıropta olmayan parça: ${id}`, itemId: id });
      continue;
    }
    items.push(item);
  }

  for (const id of options.excluded || []) {
    if (seen.has(id)) violations.push({ code: 'excluded_item', message: `Yasaklanan parça kullanılmış: ${id}`, itemId: id });
  }
  for (const id of options.required || []) {
    if (!seen.has(id)) violations.push({ code: 'missing_required', message: `Zorunlu parça eksik: ${id}`, itemId: id });
  }

  const counts: Record<string, number> = {};
  for (const item of items) counts[item.category] = (counts[item.category] || 0) + 1;
  for (const [category, count] of Object.entries(counts)) {
    if (count > (LIMITS[category] ?? 1)) {
      violations.push({ code: 'too_many', message: `"${category}" kategorisinden en fazla ${LIMITS[category] ?? 1} parça olabilir.` });
    }
  }

  const hasOnepiece = (counts.onepiece || 0) > 0;
  const hasTop = (counts.top || 0) > 0;
  const hasBottom = (counts.bottom || 0) > 0;
  if (hasOnepiece && (hasTop || hasBottom)) {
    violations.push({ code: 'structure', message: 'Tek parça giysiyle birlikte ayrıca üst veya alt seçilmemeli.' });
  } else if (!hasOnepiece && !(hasTop && hasBottom)) {
    violations.push({ code: 'structure', message: 'Kombinde bir üst ve bir alt ya da bir tek parça giysi olmalı.' });
  }
  if (!counts.shoes) {
    violations.push({ code: 'structure', message: 'Kombinde ayakkabı olmalı.' });
  }

  const ctx = options.ctx;
  if (ctx?.weather && ctx.tempBand) {
    const outer = items.find(i => i.category === 'outerwear');
    const shoes = items.find(i => i.category === 'shoes');
    if (ctx.outerwear === 'required' && !outer && options.ownsOuterwear) {
      violations.push({ code: 'weather_outerwear_missing', message: `Hava ${ctx.weather.feelsLikeC}°C hissediliyor; dış giyim gerekli.` });
    }
    if (ctx.tempBand === 'hot' && outer && outer.warmth >= 3) {
      violations.push({ code: 'weather_outerwear_heavy', message: 'Çok sıcak havada kalın dış giyim seçilmiş.', itemId: outer.id });
    }
    if ((ctx.tempBand === 'freezing' || ctx.tempBand === 'cold') && shoes && shoes.warmth <= 1) {
      violations.push({ code: 'weather_shoes', message: 'Soğuk havada açık ayakkabı (sandalet/terlik) seçilmiş.', itemId: shoes.id });
    }
  }

  return violations;
}
