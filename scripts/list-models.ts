// API anahtarının erişebildiği Gemini modellerini listeler ve kodda kullanılan modellerin erişilebilirliğini kontrol eder.
//   npx tsx scripts/list-models.ts
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { modelsFor, EMBEDDING_MODEL, AiTask } from '../backend/ai/models.js';

const TASKS: AiTask[] = ['stylist', 'vision', 'light', 'analysis', 'segmentation'];

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY tanımlı değil.');
    process.exit(1);
  }
  const ai = new GoogleGenAI({ apiKey });

  // SDK 2.x sayfalı sonuç döndürür; tüm sayfalar for await ile gezilir
  const available = new Set<string>();
  const pager = await ai.models.list({ config: { pageSize: 100 } });
  console.log('--- Kullanılabilir modeller ---');
  for await (const model of pager) {
    const name = (model.name || '').replace(/^models\//, '');
    available.add(name);
    console.log(`${name}${model.displayName ? ` (${model.displayName})` : ''}`);
  }

  console.log('\n--- Koddaki model listeleri ---');
  let missing = 0;
  for (const task of TASKS) {
    for (const model of modelsFor(task)) {
      const ok = available.has(model);
      if (!ok) missing++;
      console.log(`${ok ? '✓' : '✗'} ${task}: ${model}`);
    }
  }
  const embeddingOk = available.has(EMBEDDING_MODEL);
  if (!embeddingOk) missing++;
  console.log(`${embeddingOk ? '✓' : '✗'} embedding: ${EMBEDDING_MODEL}`);

  if (missing > 0) {
    console.error(`\n${missing} model bu anahtarla erişilebilir değil.`);
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error('Hata:', err?.message || err);
  process.exit(1);
});
