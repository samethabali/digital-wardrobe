import { CATEGORY_LABELS, FIT_LABELS, NEUTRAL_COLOR_FAMILIES, STYLE_LABELS, ColorFamily } from '../../shared/wardrobe.js';
import type { EngineItem } from './items.js';
import type { StyleContext } from './context.js';
import type { ScoredOutfit } from './builder.js';
import { toSlots } from './scoring.js';

const MAIN = new Set(['top', 'bottom', 'onepiece', 'outerwear', 'shoes']);

function accentsOf(items: EngineItem[]): ColorFamily[] {
  const set = new Set<ColorFamily>();
  for (const item of items) {
    if (MAIN.has(item.category) && item.colorFamily && !NEUTRAL_COLOR_FAMILIES.includes(item.colorFamily)) set.add(item.colorFamily);
  }
  return Array.from(set);
}

const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase('tr-TR') + s.slice(1);

/** LLM kullanılamadığında kombin için kısa başlık. */
export function deterministicTitle(outfit: ScoredOutfit, ctx: StyleContext): string {
  const accents = accentsOf(outfit.items);
  const families = new Set(outfit.items.filter(i => MAIN.has(i.category) && i.category !== 'shoes' && i.colorFamily).map(i => i.colorFamily));
  let palette: string;
  if (families.size === 1) palette = `Ton-sür-ton ${Array.from(families)[0]}`;
  else if (accents.length === 0) palette = 'Nötr ve dengeli';
  else if (accents.length === 1) palette = `${capitalize(accents[0])} vurgulu`;
  else palette = 'Renkli ve iddialı';
  return `${palette} ${ctx.eventLabel.toLocaleLowerCase('tr-TR')} kombini`.slice(0, 60);
}

/** LLM kullanılamadığında puan bileşenlerinden üretilen açıklama. */
export function deterministicReason(outfit: ScoredOutfit, ctx: StyleContext): string {
  const s = toSlots(outfit.items);
  const sentences: string[] = [];

  if (ctx.weather) {
    const weather = `${ctx.weather.condition.toLocaleLowerCase('tr-TR')} ve hissedilen ${Math.round(ctx.weather.feelsLikeC)}°C hava`;
    if (s.outer) {
      const role = ctx.needsWaterResistant && s.outer.waterResistant ? 'yağışa karşı koruyor' : 'sıcak tutuyor';
      sentences.push(`${capitalize(weather)} için ${s.outer.name} ${role}.`);
    } else if (ctx.tempBand === 'hot' || ctx.tempBand === 'warm') {
      sentences.push(`${capitalize(weather)} için hafif ve tek katlı bir kombin.`);
    } else {
      sentences.push(`${capitalize(weather)} için katmanlar dengeli tutuldu.`);
    }
  }

  const accents = accentsOf(outfit.items);
  if (accents.length === 0) sentences.push('Nötr tonlar sakin ve birbiriyle kolayca uyum sağlayan bir palet oluşturuyor.');
  else if (accents.length === 1) sentences.push(`Nötr bir zemin üzerinde ${accents[0]} tek vurgu rengi olarak öne çıkıyor.`);
  else sentences.push(`${capitalize(accents[0])} ve ${accents[1]} birlikte canlı bir renk dengesi kuruyor.`);

  if (s.top && s.bottom && s.top.fit !== 'belirsiz' && s.bottom.fit !== 'belirsiz' && s.top.fit !== s.bottom.fit) {
    sentences.push(`${FIT_LABELS[s.top.fit] || s.top.fit} üst ile ${(FIT_LABELS[s.bottom.fit] || s.bottom.fit).toLocaleLowerCase('tr-TR')} alt silüeti dengeliyor.`);
  } else {
    const styles = Array.from(new Set(outfit.items.filter(i => MAIN.has(i.category)).map(i => STYLE_LABELS[i.style] || i.style)));
    sentences.push(`${styles.slice(0, 2).join(' ve ')} çizgideki parçalar ${ctx.eventLabel.toLocaleLowerCase('tr-TR')} için uygun resmiyette.`);
  }
  return sentences.join(' ');
}

/** LLM'e verilecek tek satırlık parça tarifi. */
export function describeItemForPrompt(item: EngineItem, locked: boolean): string {
  const attrs = [
    CATEGORY_LABELS[item.category] || item.category,
    item.subCategory,
    item.colorFamily ? `renk: ${item.colorFamily}` : null,
    item.material && item.material !== 'belirsiz' ? `kumaş: ${item.material}` : null,
    item.pattern && item.pattern !== 'belirsiz' ? `desen: ${item.pattern}` : null,
    item.fit && item.fit !== 'belirsiz' ? `kesim: ${item.fit}` : null,
    `stil: ${STYLE_LABELS[item.style] || item.style}`,
    `resmiyet ${item.formality}/5`,
    item.category !== 'accessory' && item.category !== 'makeup' ? `sıcak tutma ${item.warmth}/5` : null,
    item.waterResistant ? 'su geçirmez' : null,
  ].filter(Boolean);
  return `${locked ? '🔒 ' : ''}[${item.id}] ${item.name} (${attrs.join(', ')})`;
}
