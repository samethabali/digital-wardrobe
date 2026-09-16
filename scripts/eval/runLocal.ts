// Veritabanı ve ağ olmadan öneri motorunu bir senaryo üzerinde çalıştırır (testler ve değerlendirme betiği için).
import { toEngineItem, EngineItem } from '../../backend/engine/items.js';
import { buildContext, StyleContext } from '../../backend/engine/context.js';
import { selectCandidates } from '../../backend/engine/candidates.js';
import { buildOutfits, ScoredOutfit } from '../../backend/engine/builder.js';
import { ScoringDeps } from '../../backend/engine/scoring.js';
import type { Scenario } from './fixtures.js';

export interface LocalRun {
  ctx: StyleContext;
  outfits: ScoredOutfit[];
  warnings: string[];
  byId: Map<string, EngineItem>;
  items: EngineItem[];
  ownsOuterwear: boolean;
  required: Set<string>;
  excluded: Set<string>;
  deps: ScoringDeps;
}

export function runLocal(docs: any[], scenario: Scenario, overrides: { required?: string[]; excluded?: string[]; deps?: ScoringDeps; limit?: number } = {}): LocalRun {
  const items = docs.map(toEngineItem);
  const byId = new Map(items.map(i => [i.id, i]));
  const ctx = buildContext({
    event: scenario.request.event,
    dressiness: scenario.request.dressiness,
    activity: scenario.request.activity,
    mood: scenario.request.mood,
    styleTags: scenario.request.styleTags,
    personalContext: scenario.request.personalContext,
    ignoreWeather: scenario.request.ignoreWeather,
    weather: scenario.weather,
    date: new Date(scenario.date),
  });
  const required = new Set(overrides.required || []);
  const excluded = new Set(overrides.excluded || []);
  const deps: ScoringDeps = { protectedIds: required, ...(overrides.deps || {}) };
  const { pool, warnings } = selectCandidates(items, ctx, { required, excluded, deps, prefs: deps.prefs });
  const ownsOuterwear = items.some(i => i.category === 'outerwear');
  const built = buildOutfits(pool, ctx, deps, { required, limit: overrides.limit ?? 10, ownsOuterwear });
  return { ctx, outfits: built.outfits, warnings: [...warnings, ...built.warnings], byId, items, ownsOuterwear, required, excluded, deps };
}
