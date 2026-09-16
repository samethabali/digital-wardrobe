// Öneri motoru değerlendirmesi: 3 örnek gardırop × 10 senaryo.
//
//   npx tsx scripts/eval-outfits.ts                  # kural motoru (kota harcamaz)
//   npx tsx scripts/eval-outfits.ts --llm --limit 4  # AI stilist dahil (GEMINI_API_KEY gerekir)
//   npx tsx scripts/eval-outfits.ts --llm --no-examples   # örnek kombinler (few-shot) olmadan karşılaştırma
//
// Sonuçlar scripts/eval/results/ altına yazılır ve aynı moddaki önceki çalıştırmayla karşılaştırılır.
// Kötüye gidiş varsa çıkış kodu 1 olur.
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { WARDROBES, SCENARIOS } from './eval/fixtures.js';
import { runLocal } from './eval/runLocal.js';
import { compareSummaries, evaluateCase, renderMarkdown, summarize, CaseResult, EvalSummary } from './eval/metrics.js';
import { runStylist } from '../backend/engine/stylist.js';
import { retrieveExamples, retrieveRules } from '../backend/knowledge/retrieval.js';

const args = process.argv.slice(2);
const useLlm = args.includes('--llm');
const withExamples = !args.includes('--no-examples');
const limitIndex = args.indexOf('--limit');
const limit = limitIndex >= 0 ? Number(args[limitIndex + 1]) || SCENARIOS.length : SCENARIOS.length;
const mode = useLlm ? (withExamples ? 'llm' : 'llm-no-examples') : 'deterministic';
const RESULTS_DIR = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'eval', 'results');

async function main() {
  const results: CaseResult[] = [];
  const scenarios = SCENARIOS.slice(0, limit);

  for (const [wardrobe, docs] of Object.entries(WARDROBES)) {
    // LLM modunda kota için yalnızca orta gardırop kullanılır
    if (useLlm && wardrobe !== 'orta') continue;
    for (const scenario of scenarios) {
      const started = Date.now();
      try {
        const run = runLocal(docs, scenario);
        let picks = run.outfits.slice(0, 3);
        let model: string | null | undefined;
        let usedFallback: boolean | undefined;
        if (useLlm && run.outfits.length) {
          const hasOnepiece = run.outfits.some(o => o.items.some(i => i.category === 'onepiece'));
          const result = await runStylist({
            ctx: run.ctx,
            candidates: run.outfits,
            rules: retrieveRules({ ctx: run.ctx, hasOnepiece }),
            examples: withExamples ? retrieveExamples(run.ctx) : [],
            personalExamples: [],
            preferenceSummary: null,
            protectedIds: run.required,
            byId: run.byId,
            scoringDeps: run.deps,
            maxPicks: 3,
          });
          picks = result.picks.map(p => p.outfit);
          model = result.model;
          usedFallback = result.usedFallback;
        }
        const evaluated = evaluateCase(wardrobe, scenario.id, run, picks, Date.now() - started);
        results.push(useLlm ? { ...evaluated, model, usedFallback } : evaluated);
      } catch (err: any) {
        results.push({
          wardrobe, scenario: scenario.id, outfits: 0, invalidOutfits: 0, violations: {}, avgScore: 0, avgWeather: null,
          avgFormality: 0, avgColor: 0, avgOverlap: 0, durationMs: Date.now() - started, error: String(err?.message || err).slice(0, 80),
        });
      }
    }
  }

  const summary = summarize(mode, results);
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const previousFile = fs.readdirSync(RESULTS_DIR).filter(f => f.endsWith(`-${mode}.json`)).sort().pop();
  const previous: EvalSummary | null = previousFile ? JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, previousFile), 'utf8')).summary : null;
  const deltas = previous ? compareSummaries(previous, summary) : null;

  const stamp = summary.createdAt.replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(RESULTS_DIR, `${stamp}-${mode}.json`), JSON.stringify({ summary, results }, null, 2));
  console.log(renderMarkdown(summary, results, deltas));

  if (deltas?.some(d => d.regression)) {
    console.error('\nÖnceki çalıştırmaya göre kötüye gidiş var.');
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
