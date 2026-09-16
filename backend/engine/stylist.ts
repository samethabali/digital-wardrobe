import { CATEGORY_LABELS } from '../../shared/wardrobe.js';
import { AiError, generateJson } from '../ai/gemini.js';
import type { KnowledgeRule } from '../knowledge/rules.js';
import type { ExampleOutfit } from '../knowledge/examples.js';
import type { EngineItem } from './items.js';
import type { StyleContext } from './context.js';
import { TEMP_BAND_LABELS } from './context.js';
import { outfitId, ScoredOutfit } from './builder.js';
import { scoreOutfit, ScoringDeps } from './scoring.js';
import { validateOutfit } from './validator.js';
import { describeItemForPrompt, deterministicReason, deterministicTitle } from './explain.js';

export interface StylistInput {
  ctx: StyleContext;
  candidates: ScoredOutfit[];
  rules: KnowledgeRule[];
  examples: ExampleOutfit[];
  personalExamples: string[];
  preferenceSummary: string | null;
  protectedIds: Set<string>;
  byId: Map<string, EngineItem>;
  scoringDeps: ScoringDeps;
  maxPicks?: number;
}

export interface StylistPick {
  outfit: ScoredOutfit;
  title: string;
  reason: string;
  swapped: boolean;
}

export interface StylistResult {
  picks: StylistPick[];
  model: string | null;
  usedFallback: boolean;
  warnings: string[];
}

interface RawPick {
  candidateId: string;
  swapOutItemId: string;
  swapInItemId: string;
  title: string;
  reason: string;
}

const SYSTEM_INSTRUCTION = `Sen deneyimli bir kişisel stilistsin ve kullanıcıyla Türkçe konuşuyorsun.
Sana kullanıcının kendi gardırobundan hazırlanmış aday kombinler veriliyor. Adaylar hava, resmiyet ve temel renk kuralları açısından önceden kontrol edildi ve puanlandı; puan yalnızca yol gösterir, son estetik karar senin.

Görevin:
1. Bağlama, stil bilgisine ve kullanıcının tercihlerine göre en iyi kombinleri seçip en iyiden başlayarak sırala. Seçtiklerin birbirinden belirgin şekilde farklı olsun.
2. Gerçekten iyileştiriyorsa, seçtiğin bir kombinde tek bir parçayı "değişiklik için kullanılabilecek parçalar" listesindeki AYNI kategoriden bir parçayla değiştirebilirsin. Değişiklik yoksa swapOutItemId ve swapInItemId boş metin olsun.
3. Her kombin için en fazla 5 kelimelik bir başlık ve 2-3 cümlelik açıklama yaz: neden bu etkinliğe ve havaya uyduğu, renk ve silüet dengesi. Kullanıcıya doğrudan hitap et.

Kurallar:
- Yalnızca verilen aday ve parça kimliklerini kullan.
- 🔒 işaretli parçalar kullanıcının zorunlu tuttuğu parçalardır; onları değiştirme.
- Açıklamalarda puanlardan, "aday" kelimesinden veya köşeli parantez içindeki teknik kimliklerden bahsetme.`;

function contextBlock(ctx: StyleContext, preferenceSummary: string | null): string {
  const lines = [
    `- Etkinlik: ${ctx.eventLabel} (resmiyet hedefi ${ctx.formality.target}/5, aralık ${ctx.formality.min}-${ctx.formality.max}; hareket düzeyi ${ctx.activity}/5)`,
  ];
  if (ctx.eventNotes) lines.push(`- Etkinlik notu: ${ctx.eventNotes}`);
  if (ctx.weather) {
    const w = ctx.weather;
    const precip = w.precipitationProbability !== null ? `, yağış olasılığı %${w.precipitationProbability}` : '';
    lines.push(`- Hava (${w.locationLabel}${w.isForecast ? `, ${w.time} tahmini` : ''}): ${w.condition}, ${w.temperatureC}°C, hissedilen ${w.feelsLikeC}°C${precip} → ${TEMP_BAND_LABELS[ctx.tempBand!]}`);
  } else {
    lines.push(ctx.ignoreWeather ? '- Hava: dikkate alınmıyor (kapalı mekan)' : '- Hava: bilgi alınamadı; mevsime uygun seç');
  }
  if (ctx.indoor) lines.push('- Etkinlik kapalı mekanda');
  if (ctx.mood) lines.push(`- Ruh hali: ${ctx.mood}`);
  if (ctx.styleTags.length) lines.push(`- İstenen stil: ${ctx.styleTags.join(', ')}`);
  if (ctx.personalContext) lines.push(`- Kullanıcının stil kimliği (kullanıcı yazdı): """${ctx.personalContext}"""`);
  if (preferenceSummary) lines.push(`- Geçmiş geri bildirimlerden tercih özeti: ${preferenceSummary}`);
  return lines.join('\n');
}

function buildPrompt(input: StylistInput, candidateIds: string[], swapPool: EngineItem[], maxPicks: number): string {
  const sections: string[] = [];
  sections.push(`BAĞLAM:\n${contextBlock(input.ctx, input.preferenceSummary)}`);

  if (input.rules.length) {
    sections.push(`STİL BİLGİSİ:\n${input.rules.map((r, i) => `${i + 1}. ${r.title}: ${r.text}`).join('\n')}`);
  }
  if (input.examples.length) {
    sections.push(`BU BAĞLAMDA İYİ ÇALIŞAN ÖRNEK KOMBİNLER (tarif, gardıroptaki parçalar değil):\n${input.examples.map(e => `- ${e.outfit} — ${e.why}`).join('\n')}`);
  }
  if (input.personalExamples.length) {
    sections.push(`KULLANICININ DAHA ÖNCE BEĞENDİĞİ / GİYDİĞİ KOMBİNLER:\n${input.personalExamples.map(e => `- ${e}`).join('\n')}`);
  }

  const candidateLines = input.candidates.map((outfit, i) => {
    const items = outfit.items.map(item => `    ${describeItemForPrompt(item, input.protectedIds.has(item.id))}`).join('\n');
    return `${candidateIds[i]} (ön puan ${outfit.breakdown.total}):\n${items}`;
  });
  sections.push(`ADAY KOMBİNLER:\n${candidateLines.join('\n')}`);

  const byCategory = new Map<string, EngineItem[]>();
  for (const item of swapPool) {
    const list = byCategory.get(item.category) || [];
    list.push(item);
    byCategory.set(item.category, list);
  }
  const poolLines = Array.from(byCategory.entries()).map(([category, items]) =>
    `${CATEGORY_LABELS[category] || category}:\n${items.map(item => `    ${describeItemForPrompt(item, false)}`).join('\n')}`);
  sections.push(`DEĞİŞİKLİK İÇİN KULLANILABİLECEK PARÇALAR:\n${poolLines.join('\n')}`);

  sections.push(`En fazla ${maxPicks} kombin seç.`);
  return sections.join('\n\n');
}

function buildSchema(candidateIds: string[], poolIds: string[], maxPicks: number) {
  return {
    type: 'object',
    properties: {
      picks: {
        type: 'array',
        minItems: 1,
        maxItems: maxPicks,
        items: {
          type: 'object',
          properties: {
            candidateId: { type: 'string', enum: candidateIds },
            swapOutItemId: { type: 'string', enum: ['', ...poolIds] },
            swapInItemId: { type: 'string', enum: ['', ...poolIds] },
            title: { type: 'string' },
            reason: { type: 'string' },
          },
          required: ['candidateId', 'swapOutItemId', 'swapInItemId', 'title', 'reason'],
        },
      },
    },
    required: ['picks'],
  };
}

interface Evaluation {
  picks: StylistPick[];
  problems: string[];
  notes: string[];
}

/** Model yanıtını doğrular, geçerli değişiklikleri uygular. Onarım gerektiren sorunları ayrı listeler. */
function evaluatePicks(raw: RawPick[], input: StylistInput, candidateIds: string[], maxPicks: number): Evaluation {
  const problems: string[] = [];
  const notes: string[] = [];
  const picks: StylistPick[] = [];
  const usedCandidates = new Set<string>();
  const usedOutfitIds = new Set<string>();
  const expected = Math.min(maxPicks, input.candidates.length);

  for (const pick of raw || []) {
    const index = candidateIds.indexOf(pick.candidateId);
    if (index === -1) { problems.push(`Geçersiz aday kimliği: ${pick.candidateId}`); continue; }
    if (usedCandidates.has(pick.candidateId)) { problems.push(`${pick.candidateId} birden fazla kez seçildi.`); continue; }
    const title = String(pick.title || '').trim();
    const reason = String(pick.reason || '').trim();
    if (!title || !reason) { problems.push(`${pick.candidateId} için başlık veya açıklama boş.`); continue; }
    usedCandidates.add(pick.candidateId);

    let outfit = input.candidates[index];
    let swapped = false;
    const out = pick.swapOutItemId;
    const inn = pick.swapInItemId;
    if (out && inn) {
      const outItem = input.byId.get(out);
      const inItem = input.byId.get(inn);
      const canSwap = outItem && inItem
        && outfit.itemIds.includes(out)
        && !outfit.itemIds.includes(inn)
        && outItem.category === inItem.category
        && !input.protectedIds.has(out);
      if (canSwap) {
        const newItems = outfit.items.map(i => (i.id === out ? inItem! : i));
        const newIds = newItems.map(i => i.id);
        const violations = validateOutfit(newIds, input.byId, { ctx: input.ctx });
        const breakdown = scoreOutfit(newItems, input.ctx, input.scoringDeps);
        if (violations.length === 0 && breakdown.total >= outfit.breakdown.total - 8) {
          outfit = { id: outfitId(newIds), itemIds: newIds, items: newItems, breakdown };
          swapped = true;
        } else {
          notes.push('Stilistin önerdiği bir parça değişikliği kuralları karşılamadığı için uygulanmadı.');
        }
      } else {
        notes.push('Stilistin önerdiği bir parça değişikliği geçersiz olduğu için uygulanmadı.');
      }
    }

    if (usedOutfitIds.has(outfit.id)) { problems.push(`${pick.candidateId} başka bir seçimle aynı kombine dönüştü.`); continue; }
    usedOutfitIds.add(outfit.id);
    picks.push({ outfit, title: title.slice(0, 60), reason: reason.slice(0, 700), swapped });
    if (picks.length >= maxPicks) break;
  }

  if (picks.length < expected) problems.push(`${expected} kombin bekleniyordu, ${picks.length} geçerli kombin geldi.`);
  return { picks, problems, notes };
}

function fallbackPicks(input: StylistInput, maxPicks: number, existing: StylistPick[] = []): StylistPick[] {
  const picks = [...existing];
  const used = new Set(picks.map(p => p.outfit.id));
  for (const outfit of input.candidates) {
    if (picks.length >= maxPicks) break;
    if (used.has(outfit.id)) continue;
    used.add(outfit.id);
    picks.push({ outfit, title: deterministicTitle(outfit, input.ctx), reason: deterministicReason(outfit, input.ctx), swapped: false });
  }
  return picks;
}

/** Aday kombinlerden en iyilerini LLM ile seçer ve açıklar; her hata durumunda kural motorunun seçimine düşer. */
export async function runStylist(input: StylistInput): Promise<StylistResult> {
  const maxPicks = input.maxPicks ?? 3;
  const warnings: string[] = [];
  if (input.candidates.length === 0) return { picks: [], model: null, usedFallback: true, warnings };

  const candidateIds = input.candidates.map((_, i) => `K${i + 1}`);
  const inCandidates = new Set(input.candidates.flatMap(c => c.itemIds));
  const poolItems = Array.from(input.byId.values()).filter(i => inCandidates.has(i.id));
  const schema = buildSchema(candidateIds, poolItems.map(i => i.id), maxPicks);
  const prompt = buildPrompt(input, candidateIds, poolItems, maxPicks);

  let model: string | null = null;
  try {
    const first = await generateJson<{ picks: RawPick[] }>({
      task: 'stylist', label: 'stylist_pick', systemInstruction: SYSTEM_INSTRUCTION, contents: prompt, schema,
    });
    model = first.info.model;
    let evaluation = evaluatePicks(first.data?.picks, input, candidateIds, maxPicks);

    if (evaluation.problems.length) {
      // Bir kez onarım: sorunları aynı modele bildir
      try {
        const repair = await generateJson<{ picks: RawPick[] }>({
          task: 'stylist',
          label: 'stylist_repair',
          systemInstruction: SYSTEM_INSTRUCTION,
          preferModel: model,
          totalBudgetMs: 20_000,
          contents: `${prompt}\n\nÖNCEKİ YANITIN ŞU SORUNLARI İÇERİYORDU, düzeltip yanıtı baştan ver:\n${evaluation.problems.map(p => `- ${p}`).join('\n')}`,
          schema,
        });
        model = repair.info.model;
        const repaired = evaluatePicks(repair.data?.picks, input, candidateIds, maxPicks);
        if (repaired.picks.length >= evaluation.picks.length) evaluation = repaired;
      } catch {
        // Onarım başarısızsa ilk yanıttaki geçerli seçimlerle devam edilir
      }
    }

    warnings.push(...Array.from(new Set(evaluation.notes)));
    const complete = fallbackPicks(input, maxPicks, evaluation.picks);
    const usedFallback = evaluation.picks.length === 0;
    return { picks: complete, model, usedFallback, warnings };
  } catch (err) {
    const message = err instanceof AiError && err.code === 'blocked'
      ? 'AI stilist bu istek için yanıt üretmedi; kombinler kural motoruyla seçildi.'
      : 'AI stilist şu an yanıt veremedi; kombinler kural motoruyla seçildi ve açıklandı.';
    warnings.push(message);
    return { picks: fallbackPicks(input, maxPicks), model, usedFallback: true, warnings };
  }
}
