import crypto from 'crypto';
import type { GenerateOutfitResponse, OutfitSuggestion, WeatherSnapshot } from '../../shared/api.js';
import { EVENTS } from '../../shared/wardrobe.js';
import { ItemModel, OutfitModel, UserModel, WearLogModel } from '../db.js';
import { generateJson } from '../ai/gemini.js';
import { getWeather, resolveLocation, ResolvedLocation, WeatherError } from '../weather.js';
import { retrieveExamples, retrieveRules } from '../knowledge/retrieval.js';
import { getTextEmbedding, loadRuleEmbeddings } from '../knowledge/embeddingStore.js';
import {
  hasConsent, loadPreferenceData, logShownOutfits, preferenceSummary, recentlyWornMap, recentShownOutfits,
} from '../preferences.js';
import { EngineItem, toEngineItem, toItemDTO } from './items.js';
import { buildContext, ContextInput, StyleContext, summarizeContext } from './context.js';
import { selectCandidates } from './candidates.js';
import { buildOutfits, ScoredOutfit } from './builder.js';
import { ScoringDeps } from './scoring.js';
import { runStylist, StylistPick } from './stylist.js';
import { validateOutfit } from './validator.js';
import { deterministicReason, deterministicTitle } from './explain.js';
import { loadReranker } from './reranker.js';
import { CleanRequest, RequestError, sanitizeStylistRequest } from './request.js';

export { RequestError };

/** Serbest metin sorgusunun embedding'i için üst sınır; aşılırsa yalnızca meta veri filtresi kullanılır. */
export const QUERY_EMBEDDING_TIMEOUT_MS = 4000;

export interface GenerateOptions {
  /** full: LLM stilist + RAG; deterministic: yalnızca kural motoru (kota harcamaz) */
  mode: 'full' | 'deterministic';
  picks?: number;
  candidateLimit?: number;
  /** Konum gönderilmezse kullanıcının son konumunu kullan */
  useLastLocation?: boolean;
  /** Hava durumu önceden çözüldüyse (beraber kombin, seyahat planı) tekrar istenmez */
  weatherOverride?: WeatherResult;
  /** Kişisel verileri (tercih profili, giyim günlüğü, son gösterilenler) kullanma — ör. arkadaşın gardırobu */
  anonymous?: boolean;
}

interface EventOverride {
  eventKey: string;
  formalityMin: number;
  formalityMax: number;
  activity: number;
  indoor: boolean;
  notes: string;
}

async function parseEventText(event: string, eventText: string): Promise<EventOverride | null> {
  const { data } = await generateJson<EventOverride>({
    task: 'light',
    label: 'event_parse',
    contents: `Kullanıcı bir kombin için etkinliğini şöyle anlattı (seçtiği tip: ${event}):\n"""${eventText}"""\n\nBu etkinliği yapılandır. formalityMin/formalityMax 1 (spor) ile 5 (resmi gece) arası, activity 1 (oturarak) ile 5 (spor) arası. notes alanına kıyafeti etkileyen önemli ayrıntıları tek kısa cümleyle yaz (yoksa boş bırak).`,
    schema: {
      type: 'object',
      properties: {
        eventKey: { type: 'string', enum: [...EVENTS, 'Özel'] },
        formalityMin: { type: 'integer', minimum: 1, maximum: 5 },
        formalityMax: { type: 'integer', minimum: 1, maximum: 5 },
        activity: { type: 'integer', minimum: 1, maximum: 5 },
        indoor: { type: 'boolean' },
        notes: { type: 'string' },
      },
      required: ['eventKey', 'formalityMin', 'formalityMax', 'activity', 'indoor', 'notes'],
    },
  });
  return data;
}

export interface WardrobeSnapshot {
  docs: any[];
  engineItems: EngineItem[];
  byId: Map<string, EngineItem>;
  dtoById: Map<string, any>;
}

export async function loadWardrobe(userId: unknown): Promise<WardrobeSnapshot> {
  const docs: any[] = await ItemModel.find({ userId } as any).select('+embedding').lean();
  const engineItems = docs.map(toEngineItem);
  return {
    docs,
    engineItems,
    byId: new Map(engineItems.map(i => [i.id, i])),
    dtoById: new Map(docs.map(d => [d.id, toItemDTO(d)])),
  };
}

/** Kullanıcının gardırobunda geçerli bir kombin kurmaya yetecek kategoriler var mı. */
export function checkWardrobeCoverage(items: EngineItem[]): string | null {
  const has = (c: string) => items.some(i => i.category === c);
  const missing: string[] = [];
  if (!has('shoes')) missing.push('ayakkabı');
  if (!has('onepiece') && !(has('top') && has('bottom'))) {
    if (!has('top')) missing.push('üst giyim');
    if (!has('bottom')) missing.push('alt giyim (ya da bir elbise/tulum)');
  }
  return missing.length ? `Kombin oluşturmak için gardırobuna şunları eklemelisin: ${missing.join(', ')}.` : null;
}

export interface WeatherResult {
  weather: WeatherSnapshot | null;
  weatherError: string | null;
  resolved: ResolvedLocation | null;
}

export async function resolveWeather(user: any, request: Pick<CleanRequest, 'location' | 'dateTime' | 'ignoreWeather'>, useLastLocation: boolean): Promise<WeatherResult> {
  if (request.ignoreWeather) return { weather: null, weatherError: null, resolved: null };
  let resolved: ResolvedLocation | null = null;
  try {
    if (request.location) {
      resolved = await resolveLocation(request.location);
      if (!resolved) return { weather: null, weatherError: 'Seçilen konum bulunamadı; hava durumu kullanılmadı.', resolved: null };
    } else if (useLastLocation && user?.lastLocation?.latitude !== undefined && user?.lastLocation?.latitude !== null) {
      resolved = { latitude: user.lastLocation.latitude, longitude: user.lastLocation.longitude, label: user.lastLocation.label || 'Son konum' };
    } else {
      return { weather: null, weatherError: 'Konum seçilmediği için hava durumu kullanılmadı.', resolved: null };
    }
    const weather = await getWeather(resolved, request.dateTime);
    return { weather, weatherError: null, resolved };
  } catch (err) {
    const message = err instanceof WeatherError ? err.message : 'Hava durumu servisine ulaşılamadı.';
    return { weather: null, weatherError: message, resolved };
  }
}

async function personalExamplesFor(user: any, ctx: StyleContext, byId: Map<string, EngineItem>): Promise<string[]> {
  if (!hasConsent(user, 'personalization')) return [];
  const [outfits, logs] = await Promise.all([
    OutfitModel.find({ userId: user._id } as any).sort({ createdAt: -1 } as any).limit(30).lean(),
    WearLogModel.find({ userId: user._id } as any).sort({ date: -1 } as any).limit(30).lean(),
  ]);
  const describe = (ids: string[]) => ids.map(id => byId.get(id)).filter(Boolean)
    .map(i => `${i!.name}${i!.colorFamily ? ` (${i!.colorFamily})` : ''}`).join(' + ');
  const scored = [
    ...(outfits as any[]).map(o => ({ ids: o.items || [], event: o.context?.event, tempBand: o.context?.tempBand })),
    ...(logs as any[]).map(l => ({ ids: l.itemIds || [], event: undefined, tempBand: undefined })),
  ]
    .map(e => ({ ...e, score: (e.event === ctx.eventLabel ? 2 : 0) + (ctx.tempBand && e.tempBand === ctx.tempBand ? 1 : 0) }))
    .filter(e => e.ids.length >= 2 && e.ids.every((id: string) => byId.has(id)))
    .sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const e of scored) {
    const text = describe(e.ids);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= 3) break;
  }
  return result;
}

export interface EngineRun {
  ctx: StyleContext;
  candidates: ScoredOutfit[];
  warnings: string[];
  deps: ScoringDeps;
  wardrobe: WardrobeSnapshot;
  required: Set<string>;
  weather: WeatherResult;
}

/** Bağlamı kurar ve kural motoruyla aday kombinleri üretir (LLM çağrısı yapmaz, olay ayrıştırma hariç). */
export async function runEngine(user: any, request: CleanRequest, options: GenerateOptions, wardrobe?: WardrobeSnapshot): Promise<EngineRun> {
  const snapshot = wardrobe || await loadWardrobe(user._id);
  const coverage = checkWardrobeCoverage(snapshot.engineItems);
  if (coverage) throw new RequestError(coverage, 422);

  const warnings: string[] = [];
  const required = new Set([...request.requiredItems, ...request.lockedItems].filter(id => snapshot.byId.has(id)));
  const excluded = new Set(request.excludedItems.filter(id => snapshot.byId.has(id)));
  for (const id of required) {
    if (excluded.has(id)) {
      excluded.delete(id);
      warnings.push('Bir parça hem zorunlu hem hariç tutulmuştu; zorunlu olarak kullanıldı.');
    }
  }

  const weather = options.weatherOverride ?? await resolveWeather(user, request, Boolean(options.useLastLocation));
  if (!options.weatherOverride && !options.anonymous && weather.resolved && request.location && request.location.type !== 'text') {
    await UserModel.updateOne({ _id: user._id } as any, {
      $set: { lastLocation: { latitude: weather.resolved.latitude, longitude: weather.resolved.longitude, label: weather.resolved.label, updatedAt: new Date() } },
    }).catch(() => undefined);
  }

  let eventOverride: ContextInput['eventOverride'] = null;
  if (options.mode === 'full' && request.eventText) {
    try {
      const parsed = await parseEventText(request.event, request.eventText);
      if (parsed) eventOverride = { ...parsed };
    } catch {
      warnings.push('Etkinlik açıklaman yorumlanamadı; seçtiğin etkinlik tipi kullanıldı.');
      eventOverride = { notes: request.eventText };
    }
  }

  const ctx = buildContext({
    event: request.event,
    eventOverride,
    dressiness: request.dressiness,
    activity: request.activity,
    effort: request.effort,
    mood: request.mood,
    styleTags: request.styleTags,
    personalContext: request.personalContext,
    ignoreWeather: request.ignoreWeather,
    weather: weather.weather,
    date: request.dateTime ? new Date(request.dateTime) : undefined,
  });

  const [prefs, recentShown, recentlyWorn, learned] = await Promise.all([
    options.anonymous ? Promise.resolve(null) : loadPreferenceData(user),
    options.anonymous ? Promise.resolve([] as string[][]) : recentShownOutfits(user),
    options.anonymous ? Promise.resolve(new Map<string, number>()) : recentlyWornMap(user._id),
    loadReranker(),
  ]);
  const deps: ScoringDeps = {
    prefs,
    recentOutfits: recentShown.length ? recentShown : request.recentOutfits,
    recentlyWorn,
    protectedIds: required,
    learned,
  };

  const { pool, warnings: candidateWarnings } = selectCandidates(snapshot.engineItems, ctx, { required, excluded, prefs, deps });
  const ownsOuterwear = snapshot.engineItems.some(i => i.category === 'outerwear');
  const built = buildOutfits(pool, ctx, deps, { required, limit: options.candidateLimit ?? 10, ownsOuterwear });
  warnings.push(...candidateWarnings, ...built.warnings);

  const candidates = built.outfits.filter(outfit => validateOutfit(outfit.itemIds, snapshot.byId, { required, excluded }).length === 0);
  if (candidates.length === 0) {
    throw new RequestError(built.warnings[built.warnings.length - 1] || 'Bu koşullarla geçerli bir kombin oluşturulamadı.', 422);
  }
  return { ctx, candidates, warnings, deps, wardrobe: snapshot, required, weather };
}

export function toSuggestion(pick: StylistPick, dtoById: Map<string, any>): OutfitSuggestion {
  return {
    id: pick.outfit.id,
    itemIds: pick.outfit.itemIds,
    items: pick.outfit.itemIds.map(id => dtoById.get(id)).filter(Boolean),
    title: pick.title,
    reason: pick.reason,
    score: pick.outfit.breakdown.total,
    breakdown: pick.outfit.breakdown,
  };
}

/** Kombin önerisinin tüm akışı. */
export async function generateOutfitsForUser(user: any, rawRequest: unknown, options: GenerateOptions): Promise<GenerateOutfitResponse> {
  const request = sanitizeStylistRequest(rawRequest);
  const run = await runEngine(user, request, options);
  const { ctx, candidates, deps, wardrobe, required } = run;
  const warnings = [...run.warnings];
  const picksWanted = options.picks ?? 3;

  let picks: StylistPick[];
  let model: string | null = null;
  let usedFallback = false;
  let rulesUsed: string[] = [];

  if (options.mode === 'full') {
    const hasOnepiece = candidates.some(c => c.items.some(i => i.category === 'onepiece'));
    let queryEmbedding: number[] | null = null;
    let ruleEmbeddings: Map<string, number[]> | undefined;
    const queryText = [ctx.personalContext, ctx.eventNotes].filter(Boolean).join('\n');
    if (queryText) {
      try {
        // İstek sırasında bilgi tabanı embedding'i hesaplanmaz (computeMissing = 0); önbellek
        // scripts/embed-knowledge.ts ve günlük zamanlanmış görevle doldurulur.
        [queryEmbedding, ruleEmbeddings] = await Promise.all([
          getTextEmbedding(queryText, 'style_query', QUERY_EMBEDDING_TIMEOUT_MS),
          loadRuleEmbeddings(0),
        ]);
      } catch {
        queryEmbedding = null;
      }
    }
    const rules = retrieveRules({ ctx, hasOnepiece, queryEmbedding, ruleEmbeddings });
    rulesUsed = rules.map(r => r.id);

    const [summary, personalExamples] = await Promise.all([
      preferenceSummary(user),
      personalExamplesFor(user, ctx, wardrobe.byId),
    ]);

    const result = await runStylist({
      ctx,
      candidates,
      rules,
      examples: retrieveExamples(ctx),
      personalExamples,
      preferenceSummary: summary,
      protectedIds: required,
      byId: wardrobe.byId,
      scoringDeps: deps,
      maxPicks: picksWanted,
    });
    picks = result.picks;
    model = result.model;
    usedFallback = result.usedFallback;
    warnings.push(...result.warnings);
  } else {
    picks = candidates.slice(0, picksWanted).map(outfit => ({
      outfit, title: deterministicTitle(outfit, ctx), reason: deterministicReason(outfit, ctx), swapped: false,
    }));
  }

  // Son güvenlik ağı: yanıta yalnızca doğrulanmış kombinler girer
  picks = picks.filter(p => validateOutfit(p.outfit.itemIds, wardrobe.byId, { required }).length === 0);
  if (picks.length === 0) throw new RequestError('Geçerli bir kombin oluşturulamadı.', 422);

  const outfits = picks.map(p => toSuggestion(p, wardrobe.dtoById));
  const generationId = crypto.randomUUID();
  const contextSummary = summarizeContext(ctx);

  await logShownOutfits(user, generationId, outfits.map(o => o.itemIds), contextSummary).catch(() => undefined);

  return {
    generationId,
    outfits,
    weather: ctx.weather,
    weatherError: run.weather.weatherError,
    context: contextSummary,
    model,
    usedFallback,
    rulesUsed,
    warnings: Array.from(new Set(warnings)),
    selectedItems: outfits[0].itemIds,
    stylingReason: outfits[0].reason,
    compatibilityScore: outfits[0].score,
  };
}
