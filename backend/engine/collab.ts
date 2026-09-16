import { NEUTRAL_COLOR_FAMILIES, ColorFamily } from '../../shared/wardrobe.js';
import type { WardrobeItemDTO, WeatherSnapshot } from '../../shared/api.js';
import { generateJson } from '../ai/gemini.js';
import { runEngine } from './generate.js';
import { sanitizeStylistRequest } from './request.js';
import type { ScoredOutfit } from './builder.js';
import { styleCompat } from './scoring.js';
import { describeItemForPrompt } from './explain.js';

const pairKey = (a: string, b: string) => [a, b].sort((x, y) => x.localeCompare(y, 'tr')).join('|');
const GOOD_ACCENT_PAIRS = new Set([
  pairKey('mavi', 'turuncu'), pairKey('mor', 'sarı'), pairKey('bordo', 'yeşil'), pairKey('pembe', 'yeşil'),
  pairKey('mavi', 'pembe'), pairKey('bordo', 'pembe'), pairKey('mavi', 'sarı'), pairKey('bordo', 'kırmızı'),
]);

function dominant(outfit: ScoredOutfit): { color: ColorFamily | null; style: string; formality: number } {
  const garments = outfit.items.filter(i => ['top', 'bottom', 'onepiece', 'outerwear'].includes(i.category));
  const colors = new Map<string, number>();
  for (const item of garments) {
    if (!item.colorFamily) continue;
    const weight = item.category === 'outerwear' ? 2 : 1;
    colors.set(item.colorFamily, (colors.get(item.colorFamily) || 0) + weight);
  }
  const color = (Array.from(colors.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] as ColorFamily) || null;
  const main = garments.find(i => i.category === 'onepiece') || garments.find(i => i.category === 'top') || garments[0];
  const formality = garments.reduce((s, i) => s + i.formality, 0) / Math.max(1, garments.length);
  return { color, style: main?.style || 'casual', formality };
}

/** İki kişinin kombinlerinin birlikte nasıl durduğu (0-100). */
export function pairHarmony(a: ScoredOutfit, b: ScoredOutfit): number {
  const da = dominant(a);
  const db = dominant(b);
  let color = 70;
  if (da.color && db.color) {
    const aNeutral = NEUTRAL_COLOR_FAMILIES.includes(da.color);
    const bNeutral = NEUTRAL_COLOR_FAMILIES.includes(db.color);
    if (da.color === db.color) color = 86;
    else if (aNeutral && bNeutral) color = 80;
    else if (aNeutral || bNeutral) color = 82;
    else color = GOOD_ACCENT_PAIRS.has(pairKey(da.color, db.color)) ? 84 : 55;
  }
  const formality = Math.max(0, 100 - 22 * Math.abs(da.formality - db.formality));
  const style = 40 + 60 * styleCompat(da.style, db.style);
  return Math.round(0.45 * color + 0.35 * formality + 0.2 * style);
}

export interface CollabPair {
  mine: ScoredOutfit;
  theirs: ScoredOutfit;
  score: number;
}

export function rankPairs(mine: ScoredOutfit[], theirs: ScoredOutfit[], limit = 5): CollabPair[] {
  const pairs: CollabPair[] = [];
  for (const m of mine) {
    for (const t of theirs) {
      const score = Math.round(0.5 * ((m.breakdown.total + t.breakdown.total) / 2) + 0.5 * pairHarmony(m, t));
      pairs.push({ mine: m, theirs: t, score });
    }
  }
  return pairs.sort((a, b) => b.score - a.score).slice(0, limit);
}

function harmonyLabel(pair: CollabPair): string {
  const a = dominant(pair.mine).color;
  const b = dominant(pair.theirs).color;
  if (a && a === b) return `Ton-sür-ton ${a} uyumu`;
  if (a && b && NEUTRAL_COLOR_FAMILIES.includes(a) && NEUTRAL_COLOR_FAMILIES.includes(b)) return 'Nötr tonlarda sakin uyum';
  return 'Dengeli renk eşleşmesi';
}

export interface CollabOutcome {
  myOutfit: string[];
  friendOutfit: string[];
  myItems: WardrobeItemDTO[];
  friendItems: WardrobeItemDTO[];
  compatibilityScore: number;
  collabReason: string;
  styleHarmony: string;
  weather: WeatherSnapshot | null;
  model: string | null;
  usedFallback: boolean;
  warnings: string[];
}

/**
 * İki gardıroptan birlikte uyumlu iki kombin üretir. İki kişi aynı etkinliğe gittiği için arkadaşın kombini de
 * başlatanın konumundaki hava durumuna göre kurulur. Arkadaşın kişisel verileri (tercih profili, giyim günlüğü) kullanılmaz.
 */
export async function generateCollab(initiator: any, friend: any, rawRequest: unknown): Promise<CollabOutcome> {
  const request = sanitizeStylistRequest(rawRequest);
  const mineRun = await runEngine(initiator, { ...request, requiredItems: [], lockedItems: [], excludedItems: [] }, { mode: 'deterministic', candidateLimit: 6 });
  const friendRun = await runEngine(
    { _id: friend._id },
    { ...request, location: undefined, requiredItems: [], lockedItems: [], excludedItems: [], recentOutfits: [] },
    { mode: 'deterministic', candidateLimit: 6, weatherOverride: mineRun.weather, anonymous: true },
  );
  const weather = mineRun.ctx.weather;

  const pairs = rankPairs(mineRun.candidates, friendRun.candidates, 5);
  const warnings = [...mineRun.warnings];
  let chosen = pairs[0];
  let reason = '';
  let label = harmonyLabel(chosen);
  let model: string | null = null;
  let usedFallback = false;

  try {
    const pairIds = pairs.map((_, i) => `P${i + 1}`);
    const describe = (outfit: ScoredOutfit) => outfit.items.map(i => `    ${describeItemForPrompt(i, false)}`).join('\n');
    const { data, info } = await generateJson<{ pairId: string; styleHarmony: string; collabReason: string }>({
      task: 'stylist',
      label: 'collab_pick',
      systemInstruction: 'Sen iki kişilik kombin uyumunda uzman bir stilistsin. Türkçe, samimi ve kısa yazarsın. Teknik kimliklerden veya puanlardan bahsetmezsin.',
      contents: `Etkinlik: ${mineRun.ctx.eventLabel}. ${weather ? `Hava: ${weather.condition}, hissedilen ${weather.feelsLikeC}°C.` : ''}\n\nİki kişinin birlikte katılacağı etkinlik için hazırlanmış kombin çiftleri:\n\n${pairs.map((p, i) => `${pairIds[i]}:\n  ${initiator.name || 'Birinci kişi'}:\n${describe(p.mine)}\n  ${friend.name || 'İkinci kişi'}:\n${describe(p.theirs)}`).join('\n\n')}\n\nBirlikte en uyumlu görünecek çifti seç. styleHarmony: çifti özetleyen en fazla 5 kelimelik etiket. collabReason: iki kombinin neden birlikte uyumlu olduğunu 3 cümleyle açıkla.`,
      schema: {
        type: 'object',
        properties: {
          pairId: { type: 'string', enum: pairIds },
          styleHarmony: { type: 'string' },
          collabReason: { type: 'string' },
        },
        required: ['pairId', 'styleHarmony', 'collabReason'],
      },
    });
    const index = pairIds.indexOf(data.pairId);
    if (index >= 0 && data.collabReason?.trim()) {
      chosen = pairs[index];
      reason = data.collabReason.trim().slice(0, 700);
      label = (data.styleHarmony || label).trim().slice(0, 60);
      model = info.model;
    } else {
      usedFallback = true;
    }
  } catch {
    usedFallback = true;
    warnings.push('AI stilist şu an yanıt veremedi; çift kural motoruyla seçildi.');
  }

  if (!reason) {
    reason = `${label}: iki kombinin baskın renkleri ve resmiyet düzeyleri birbirine yakın, bu yüzden yan yana dengeli görünüyor. `
      + `Etkinlik (${mineRun.ctx.eventLabel.toLocaleLowerCase('tr-TR')}) için ikisi de uygun seviyede.`;
  }

  return {
    myOutfit: chosen.mine.itemIds,
    friendOutfit: chosen.theirs.itemIds,
    myItems: chosen.mine.itemIds.map(id => mineRun.wardrobe.dtoById.get(id)).filter(Boolean),
    friendItems: chosen.theirs.itemIds.map(id => friendRun.wardrobe.dtoById.get(id)).filter(Boolean),
    compatibilityScore: chosen.score,
    collabReason: reason,
    styleHarmony: label,
    weather,
    model,
    usedFallback,
    warnings,
  };
}
