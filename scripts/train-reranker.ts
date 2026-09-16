// Kullanıcı geri bildirimlerinden uyum yeniden sıralayıcısını (lojistik regresyon) eğitir.
// Yeterli veri ve doğrulama başarısı yoksa model kaydedilmez; motor onsuz çalışmaya devam eder.
//   npx tsx scripts/train-reranker.ts            # eğit ve kaydet
//   npx tsx scripts/train-reranker.ts --dry-run  # yalnızca rapor
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectToDatabase, FeedbackEventModel, ItemModel, ModelArtifactModel } from '../backend/db.js';
import { toEngineItem, EngineItem } from '../backend/engine/items.js';
import { buildTrainingSamples, trainReranker, FeedbackRecord } from '../backend/engine/rerankerTraining.js';
import { RERANKER_NAME } from '../backend/engine/reranker.js';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  await connectToDatabase();

  const events: any[] = await FeedbackEventModel.find({ type: { $in: ['shown', 'saved', 'worn', 'liked', 'disliked', 'rerolled'] } } as any)
    .select('userId type generationId itemIds context createdAt').lean();
  const records: FeedbackRecord[] = events.map(e => ({ ...e, userId: e.userId.toString(), itemIds: e.itemIds || [] }));
  const userIds = Array.from(new Set(records.map(r => r.userId)));

  const itemsByUser = new Map<string, Map<string, EngineItem>>();
  const docs: any[] = await ItemModel.find({ userId: { $in: userIds } } as any).select('+embedding').lean();
  for (const doc of docs) {
    const key = doc.userId.toString();
    if (!itemsByUser.has(key)) itemsByUser.set(key, new Map());
    itemsByUser.get(key)!.set(doc.id, toEngineItem(doc));
  }

  const samples = buildTrainingSamples(records, itemsByUser);
  console.log(`${records.length} olay, ${userIds.length} kullanıcı → ${samples.length} etiketli kombin.`);
  const outcome = trainReranker(samples);

  if ('reason' in outcome) {
    console.log(`Model kaydedilmedi: ${outcome.reason} (pozitif ${outcome.positives}, negatif ${outcome.negatives}).`);
  } else {
    const { model } = outcome as { model: import('../backend/engine/reranker.js').RerankerModel };
    console.log(`Doğrulama AUC: ${model.validationAuc.toFixed(3)} (pozitif ${model.positives}, negatif ${model.negatives}).`);
    if (dryRun) {
      console.log('--dry-run: kaydedilmedi.');
    } else {
      await ModelArtifactModel.updateOne({ name: RERANKER_NAME } as any, { $set: { payload: model, trainedAt: new Date() } }, { upsert: true });
      console.log(`"${RERANKER_NAME}" kaydedildi. Sunucular 10 dakika içinde yeni modeli kullanır.`);
    }
  }
  await mongoose.disconnect();
}

main().catch(async err => {
  console.error(err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
