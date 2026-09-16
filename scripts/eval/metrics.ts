// Değerlendirme metrikleri (saf fonksiyonlar; betik ve testler kullanır).
import type { ScoredOutfit } from '../../backend/engine/builder.js';
import { validateOutfit } from '../../backend/engine/validator.js';
import type { LocalRun } from './runLocal.js';

export interface CaseResult {
  wardrobe: string;
  scenario: string;
  outfits: number;
  invalidOutfits: number;
  violations: Record<string, number>;
  avgScore: number;
  avgWeather: number | null;
  avgFormality: number;
  avgColor: number;
  /** Kombin çiftleri arasında ortak ana parça oranının ortalaması (düşük = çeşitli) */
  avgOverlap: number;
  durationMs: number;
  model?: string | null;
  usedFallback?: boolean;
  error?: string;
}

const MAIN = new Set(['top', 'bottom', 'onepiece', 'outerwear', 'shoes']);
const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
const round1 = (v: number) => Math.round(v * 10) / 10;

export function overlap(a: ScoredOutfit, b: ScoredOutfit): number {
  const aMain = a.items.filter(i => MAIN.has(i.category)).map(i => i.id);
  const bMain = new Set(b.items.filter(i => MAIN.has(i.category)).map(i => i.id));
  return aMain.filter(id => bMain.has(id)).length / Math.max(aMain.length, bMain.size, 1);
}

export function evaluateCase(wardrobe: string, scenario: string, run: LocalRun, picks: ScoredOutfit[], durationMs: number): CaseResult {
  const violations: Record<string, number> = {};
  let invalidOutfits = 0;
  for (const outfit of picks) {
    const found = validateOutfit(outfit.itemIds, run.byId, { ctx: run.ctx, ownsOuterwear: run.ownsOuterwear, required: run.required, excluded: run.excluded });
    if (found.length) invalidOutfits++;
    for (const v of found) violations[v.code] = (violations[v.code] || 0) + 1;
  }
  const overlaps: number[] = [];
  for (let i = 0; i < picks.length; i++) for (let j = i + 1; j < picks.length; j++) overlaps.push(overlap(picks[i], picks[j]));
  const weather = picks.map(p => p.breakdown.weather).filter((v): v is number => v !== null);
  return {
    wardrobe,
    scenario,
    outfits: picks.length,
    invalidOutfits,
    violations,
    avgScore: round1(mean(picks.map(p => p.breakdown.total))),
    avgWeather: weather.length ? round1(mean(weather)) : null,
    avgFormality: round1(mean(picks.map(p => p.breakdown.formality))),
    avgColor: round1(mean(picks.map(p => p.breakdown.color))),
    avgOverlap: Math.round(mean(overlaps) * 100) / 100,
    durationMs: Math.round(durationMs),
  };
}

export interface EvalSummary {
  mode: string;
  createdAt: string;
  cases: number;
  emptyCases: number;
  outfits: number;
  invalidRate: number;
  violations: Record<string, number>;
  avgScore: number;
  avgWeather: number | null;
  avgOverlap: number;
  avgDurationMs: number;
  fallbackRate: number | null;
}

export function summarize(mode: string, results: CaseResult[], createdAt = new Date().toISOString()): EvalSummary {
  const outfits = results.reduce((s, r) => s + r.outfits, 0);
  const invalid = results.reduce((s, r) => s + r.invalidOutfits, 0);
  const violations: Record<string, number> = {};
  for (const r of results) for (const [code, n] of Object.entries(r.violations)) violations[code] = (violations[code] || 0) + n;
  const weather = results.map(r => r.avgWeather).filter((v): v is number => v !== null);
  const llm = results.filter(r => r.usedFallback !== undefined);
  return {
    mode,
    createdAt,
    cases: results.length,
    emptyCases: results.filter(r => r.outfits === 0).length,
    outfits,
    invalidRate: outfits ? Math.round((invalid / outfits) * 1000) / 1000 : 0,
    violations,
    avgScore: round1(mean(results.filter(r => r.outfits).map(r => r.avgScore))),
    avgWeather: weather.length ? round1(mean(weather)) : null,
    avgOverlap: Math.round(mean(results.filter(r => r.outfits > 1).map(r => r.avgOverlap)) * 100) / 100,
    avgDurationMs: Math.round(mean(results.map(r => r.durationMs))),
    fallbackRate: llm.length ? Math.round((llm.filter(r => r.usedFallback).length / llm.length) * 100) / 100 : null,
  };
}

export interface SummaryDelta {
  metric: string;
  previous: number | null;
  current: number | null;
  delta: number | null;
  /** true: değişim kötüye gidiş */
  regression: boolean;
}

/** İki çalıştırmayı karşılaştırır. Kötüye gidiş eşikleri: ihlal oranı artışı, puanda 2'den fazla düşüş. */
export function compareSummaries(previous: EvalSummary, current: EvalSummary): SummaryDelta[] {
  const rows: [string, number | null, number | null, (d: number) => boolean][] = [
    ['invalidRate', previous.invalidRate, current.invalidRate, d => d > 0],
    ['emptyCases', previous.emptyCases, current.emptyCases, d => d > 0],
    ['avgScore', previous.avgScore, current.avgScore, d => d < -2],
    ['avgWeather', previous.avgWeather, current.avgWeather, d => d < -2],
    ['avgOverlap', previous.avgOverlap, current.avgOverlap, d => d > 0.1],
    ['avgDurationMs', previous.avgDurationMs, current.avgDurationMs, d => d > Math.max(200, (previous.avgDurationMs || 0) * 0.5)],
    ['fallbackRate', previous.fallbackRate, current.fallbackRate, d => d > 0.1],
  ];
  return rows.map(([metric, prev, cur, isRegression]) => {
    const delta = prev === null || cur === null ? null : Math.round((cur - prev) * 1000) / 1000;
    return { metric, previous: prev, current: cur, delta, regression: delta !== null && isRegression(delta) };
  });
}

export function renderMarkdown(summary: EvalSummary, results: CaseResult[], deltas: SummaryDelta[] | null): string {
  const lines: string[] = [];
  lines.push(`## Değerlendirme (${summary.mode}) — ${summary.createdAt}`, '');
  lines.push('| Gardırop | Senaryo | Kombin | Geçersiz | Puan | Hava | Örtüşme | Süre (ms) |', '|---|---|---|---|---|---|---|---|');
  for (const r of results) {
    lines.push(`| ${r.wardrobe} | ${r.scenario} | ${r.outfits} | ${r.invalidOutfits} | ${r.avgScore} | ${r.avgWeather ?? '-'} | ${r.avgOverlap} | ${r.durationMs}${r.error ? ` ⚠ ${r.error}` : ''} |`);
  }
  lines.push('', `**Özet:** ${summary.cases} durum, ${summary.outfits} kombin, geçersiz oranı ${summary.invalidRate}, ortalama puan ${summary.avgScore}, ortalama süre ${summary.avgDurationMs} ms${summary.fallbackRate !== null ? `, yedek kullanım oranı ${summary.fallbackRate}` : ''}.`);
  if (Object.keys(summary.violations).length) lines.push(`İhlaller: ${Object.entries(summary.violations).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  if (deltas) {
    lines.push('', '| Metrik | Önceki | Şimdi | Fark |', '|---|---|---|---|');
    for (const d of deltas) lines.push(`| ${d.metric} | ${d.previous ?? '-'} | ${d.current ?? '-'} | ${d.delta ?? '-'}${d.regression ? ' ❌' : ''} |`);
  }
  return lines.join('\n');
}
