import crypto from 'crypto';
import type { ScoreBreakdown } from '../../shared/api.js';
import type { EngineItem } from './items.js';
import type { StyleContext } from './context.js';
import type { CandidatePool } from './candidates.js';
import { scoreOutfit, ScoringDeps } from './scoring.js';

export interface ScoredOutfit {
  id: string;
  itemIds: string[];
  items: EngineItem[];
  breakdown: ScoreBreakdown;
}

export interface BuildOptions {
  required: Set<string>;
  limit?: number;
  /** Kullanıcının gardırobunda hiç dış giyim var mı */
  ownsOuterwear?: boolean;
}

const CATEGORY_ORDER: Record<string, number> = { outerwear: 0, top: 1, onepiece: 1, bottom: 2, shoes: 3, accessory: 4, makeup: 5 };

export function outfitId(itemIds: string[]): string {
  return crypto.createHash('sha1').update([...itemIds].sort().join('|')).digest('hex').slice(0, 12);
}

function makeOutfit(items: EngineItem[], ctx: StyleContext, deps: ScoringDeps): ScoredOutfit {
  const ordered = [...items].sort((a, b) => (CATEGORY_ORDER[a.category] ?? 9) - (CATEGORY_ORDER[b.category] ?? 9));
  const itemIds = ordered.map(i => i.id);
  return { id: outfitId(itemIds), itemIds, items: ordered, breakdown: scoreOutfit(ordered, ctx, deps) };
}

const MAIN = new Set(['top', 'bottom', 'onepiece', 'outerwear', 'shoes']);

function similarity(a: ScoredOutfit, b: ScoredOutfit): number {
  const aMain = a.items.filter(i => MAIN.has(i.category)).map(i => i.id);
  const bMain = new Set(b.items.filter(i => MAIN.has(i.category)).map(i => i.id));
  const shared = aMain.filter(id => bMain.has(id)).length;
  return shared / Math.max(aMain.length, bMain.size, 1);
}

/** En yüksek puanlıları seçerken birbirinin neredeyse aynısı olan kombinleri geriye iter. */
export function pickDiverse(sorted: ScoredOutfit[], limit: number, maxSimilarity = 0.67): ScoredOutfit[] {
  const picked: ScoredOutfit[] = [];
  for (const outfit of sorted) {
    if (picked.length >= limit) break;
    if (picked.every(p => similarity(p, outfit) <= maxSimilarity)) picked.push(outfit);
  }
  for (const outfit of sorted) {
    if (picked.length >= limit) break;
    if (!picked.includes(outfit)) picked.push(outfit);
  }
  return picked;
}

/**
 * Aday havuzundan geçerli kombin şablonlarının tamamını üretir, puanlar ve çeşitli en iyi kombinleri döndürür.
 * Şablonlar: üst + alt + ayakkabı (+dış) veya tek parça + ayakkabı (+dış); ardından aksesuar/makyaj eklenir.
 */
export function buildOutfits(pool: CandidatePool, ctx: StyleContext, deps: ScoringDeps, options: BuildOptions): { outfits: ScoredOutfit[]; warnings: string[] } {
  const warnings: string[] = [];
  const limit = options.limit ?? 10;
  const forced = (category: keyof CandidatePool) => pool[category].filter(s => options.required.has(s.item.id)).map(s => s.item);

  const forcedTop = forced('top');
  const forcedBottom = forced('bottom');
  const forcedOnepiece = forced('onepiece');
  const forcedOuter = forced('outerwear');
  const forcedShoes = forced('shoes');
  const forcedAccessories = forced('accessory').slice(0, 2);
  const forcedMakeup = forced('makeup').slice(0, 1);

  for (const [list, name] of [[forcedTop, 'üst'], [forcedBottom, 'alt'], [forcedOnepiece, 'tek parça'], [forcedOuter, 'dış giyim'], [forcedShoes, 'ayakkabı']] as const) {
    if (list.length > 1) warnings.push(`Aynı kombinde birden fazla ${name} zorunlu tutulamaz; ilki kullanıldı.`);
  }

  const tops = forcedTop.length ? [forcedTop[0]] : pool.top.map(s => s.item);
  const bottoms = forcedBottom.length ? [forcedBottom[0]] : pool.bottom.map(s => s.item);
  const onepieces = forcedOnepiece.length ? [forcedOnepiece[0]] : pool.onepiece.map(s => s.item);
  const shoes = forcedShoes.length ? [forcedShoes[0]] : pool.shoes.map(s => s.item);
  // Kapalı mekan (hava yok sayılıyor) için kalın mont/kaban önerilmez; blazer gibi hafif dış katmanlar kalır
  const outers = pool.outerwear.map(s => s.item).filter(o => !ctx.ignoreWeather || o.warmth <= 3);

  let useSeparates = forcedOnepiece.length === 0;
  const useOnepiece = forcedTop.length === 0 && forcedBottom.length === 0;
  if (forcedOnepiece.length && (forcedTop.length || forcedBottom.length)) {
    warnings.push('Tek parça giysi ile üst/alt aynı anda zorunlu tutulamaz; üst + alt kullanıldı.');
    useSeparates = true;
  }

  if (shoes.length === 0) {
    return { outfits: [], warnings: [...warnings, 'Kombin oluşturmak için gardırobuna en az bir ayakkabı eklemelisin.'] };
  }

  let outerOptions: Array<EngineItem | null>;
  if (forcedOuter.length) outerOptions = [forcedOuter[0]];
  else if (ctx.outerwear === 'avoid') outerOptions = [null];
  else if (ctx.outerwear === 'required' && outers.length) outerOptions = outers;
  else outerOptions = [null, ...outers];
  if (ctx.outerwear === 'required' && !forcedOuter.length && outers.length === 0) {
    warnings.push(options.ownsOuterwear
      ? 'Hava soğuk ama bu etkinliğe uygun dış giyim bulunamadı.'
      : 'Hava soğuk; gardırobuna dış giyim (mont, kaban) eklersen öneriler daha isabetli olur.');
  }

  const base: ScoredOutfit[] = [];
  const pushCombo = (items: Array<EngineItem | null>) => {
    base.push(makeOutfit(items.filter(Boolean) as EngineItem[], ctx, deps));
  };

  for (const shoe of shoes) {
    for (const outer of outerOptions) {
      if (useSeparates) {
        for (const top of tops) {
          for (const bottom of bottoms) pushCombo([top, bottom, shoe, outer]);
        }
      }
      if (useOnepiece && (!useSeparates || forcedOnepiece.length === 0)) {
        for (const piece of onepieces) pushCombo([piece, shoe, outer]);
      }
    }
  }

  if (base.length === 0) {
    const missing = useSeparates && (tops.length === 0 || bottoms.length === 0) && onepieces.length === 0
      ? 'Kombin oluşturmak için gardırobunda en az bir üst ve bir alt (ya da bir tek parça giysi) olmalı.'
      : 'Seçilen zorunlu parçalarla geçerli bir kombin oluşturulamadı.';
    return { outfits: [], warnings: [...warnings, missing] };
  }

  base.sort((a, b) => b.breakdown.total - a.breakdown.total);
  const shortlist = base.slice(0, 40);

  const accessories = pool.accessory.map(s => s.item).filter(a => !forcedAccessories.includes(a));
  const makeupOptions = pool.makeup.map(s => s.item).filter(m => !forcedMakeup.includes(m));
  const tryMakeup = forcedMakeup.length === 0 && ctx.formality.target >= 3.5 && makeupOptions.length > 0;

  const finished = shortlist.map(outfit => {
    let best = makeOutfit([...outfit.items, ...forcedAccessories, ...forcedMakeup], ctx, deps);
    if (forcedAccessories.length < 1 && accessories.length > 0) {
      // Şık etkinliklerde puanı belirgin düşürmeyen bir aksesuar "son dokunuş" olarak eklenir
      const tolerance = ctx.formality.target >= 3 ? 1 : 0;
      let bestAccessory: ScoredOutfit | null = null;
      for (const accessory of accessories) {
        const candidate = makeOutfit([...best.items, accessory], ctx, deps);
        if (!bestAccessory || candidate.breakdown.total > bestAccessory.breakdown.total) bestAccessory = candidate;
      }
      if (bestAccessory && bestAccessory.breakdown.total >= best.breakdown.total - tolerance) best = bestAccessory;
    }
    if (tryMakeup) {
      const withAccessory = best;
      for (const makeup of makeupOptions) {
        const candidate = makeOutfit([...withAccessory.items, makeup], ctx, deps);
        if (candidate.breakdown.total >= best.breakdown.total) best = candidate;
      }
    }
    return best;
  });

  finished.sort((a, b) => b.breakdown.total - a.breakdown.total);
  return { outfits: pickDiverse(finished, limit), warnings };
}
