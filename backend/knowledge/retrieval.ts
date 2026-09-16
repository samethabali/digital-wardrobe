import { normalizeTr, STYLE_TAGS } from '../../shared/wardrobe.js';
import { cosine } from '../ai/gemini.js';
import type { StyleContext } from '../engine/context.js';
import { KNOWLEDGE_RULES, KnowledgeRule, RuleCategory } from './rules.js';
import { EXAMPLE_OUTFITS, ExampleOutfit } from './examples.js';

export const RULE_QUOTAS: Record<RuleCategory, number> = {
  occasion: 2, weather: 2, color: 2, proportion: 1, pattern: 1, fabric: 1,
  style: 1, mood: 1, shoes: 1, accessory: 1, onepiece: 1,
};
export const MAX_RULES = 9;

// Serbest metinden kural seçimi yalnızca bu kategorilerde ince ayar yapabilir.
// Etkinlik ve hava kuralları asla metinle tetiklenmez (ör. "ofiste çalışırım" yazan birine spor günü ofis kuralı gelmesin).
const TEXT_TUNABLE: Set<RuleCategory> = new Set(['color', 'pattern', 'fabric', 'proportion', 'style', 'mood', 'accessory', 'shoes']);

export interface RetrievalInput {
  ctx: StyleContext;
  hasOnepiece: boolean;
  /** Stil kimliği / etkinlik notu için sorgu embedding'i */
  queryEmbedding?: number[] | null;
  ruleEmbeddings?: Map<string, number[]>;
  rules?: KnowledgeRule[];
}

/** Serbest metinde geçen stil etiketi adlarını tam kelime olarak yakalar (yalnızca stil kurallarını etkiler). */
export function styleTagsFromText(text: string | null | undefined): string[] {
  const normalized = ` ${normalizeTr(text).replace(/[^\p{L}\p{N}&\s-]/gu, ' ')} `;
  if (!normalized.trim()) return [];
  return STYLE_TAGS.filter(tag => normalized.includes(` ${normalizeTr(tag)} `));
}

/** Kural bağlama uyuyorsa puanını, uymuyorsa null döndürür. Tüm belirtilen koşullar sağlanmalıdır. */
export function ruleMatchScore(rule: KnowledgeRule, input: RetrievalInput, textTags: string[] = []): number | null {
  const { ctx } = input;
  let score = rule.priority ?? 2;
  let constrained = false;

  if (rule.events) {
    constrained = true;
    if (ctx.event === 'Özel' || !rule.events.includes(ctx.event)) return null;
    score += 4;
  }
  if (rule.tempBands) {
    constrained = true;
    if (!ctx.tempBand || !rule.tempBands.includes(ctx.tempBand)) return null;
    score += 3;
  }
  if (rule.precipitation) {
    constrained = true;
    if (ctx.precipitation === 'none' || !rule.precipitation.includes(ctx.precipitation)) return null;
    score += 3;
  }
  if (rule.seasons) {
    constrained = true;
    if (!rule.seasons.includes(ctx.season)) return null;
    score += 1;
  }
  if (rule.formality) {
    constrained = true;
    const [min, max] = rule.formality;
    if (ctx.formality.target < min - 0.5 || ctx.formality.target > max + 0.5) return null;
    score += 1;
  }
  if (rule.styleTags) {
    constrained = true;
    const explicit = rule.styleTags.some(t => ctx.styleTags.includes(t));
    const fromText = TEXT_TUNABLE.has(rule.category) && rule.styleTags.some(t => textTags.includes(t));
    if (!explicit && !fromText) return null;
    score += explicit ? 3 : 2;
  }
  if (rule.moods) {
    constrained = true;
    if (!ctx.mood || !rule.moods.includes(ctx.mood)) return null;
    score += 2;
  }
  if (rule.requiresOnepiece) {
    constrained = true;
    if (!input.hasOnepiece) return null;
    score += 2;
  }
  if (!constrained && !rule.general) return null;

  if (TEXT_TUNABLE.has(rule.category) && input.queryEmbedding && input.ruleEmbeddings) {
    const sim = cosine(input.queryEmbedding, input.ruleEmbeddings.get(rule.id));
    if (sim !== null) score += 4 * Math.max(0, (sim - 0.5) / 0.5);
  }
  return score;
}

/** Bağlama en uygun kuralları kategori kotalarıyla seçer. */
export function retrieveRules(input: RetrievalInput): KnowledgeRule[] {
  const rules = input.rules || KNOWLEDGE_RULES;
  const textTags = styleTagsFromText([input.ctx.personalContext, input.ctx.eventNotes].filter(Boolean).join(' '));

  const scored = rules
    .map(rule => ({ rule, score: ruleMatchScore(rule, input, textTags) }))
    .filter((r): r is { rule: KnowledgeRule; score: number } => r.score !== null)
    .sort((a, b) => b.score - a.score || a.rule.id.localeCompare(b.rule.id));

  const used: Partial<Record<RuleCategory, number>> = {};
  const picked: KnowledgeRule[] = [];
  for (const { rule } of scored) {
    if (picked.length >= MAX_RULES) break;
    const count = used[rule.category] || 0;
    if (count >= RULE_QUOTAS[rule.category]) continue;
    used[rule.category] = count + 1;
    picked.push(rule);
  }
  return picked;
}

/** Bağlama en yakın örnek kombinler. */
export function retrieveExamples(ctx: StyleContext, limit = 2): ExampleOutfit[] {
  return EXAMPLE_OUTFITS
    .map(example => {
      let score = 0;
      if (ctx.event !== 'Özel' && example.events.includes(ctx.event)) score += 3;
      if (ctx.tempBand && example.tempBands.includes(ctx.tempBand)) score += 2;
      if (example.precipitation && ctx.precipitation !== 'none' && example.precipitation.includes(ctx.precipitation)) score += 2;
      const [min, max] = example.formality;
      if (ctx.formality.target >= min - 0.5 && ctx.formality.target <= max + 0.5) score += 1;
      if (example.styleTags?.some(t => ctx.styleTags.includes(t))) score += 2;
      return { example, score };
    })
    .filter(e => e.score >= 3)
    .sort((a, b) => b.score - a.score || a.example.id.localeCompare(b.example.id))
    .slice(0, limit)
    .map(e => e.example);
}

export function ruleEmbeddingText(rule: KnowledgeRule): string {
  return `${rule.title}: ${rule.text}`;
}
