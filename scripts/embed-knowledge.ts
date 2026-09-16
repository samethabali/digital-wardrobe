// Stil bilgi tabanındaki tüm kuralların embedding'lerini hesaplayıp MongoDB önbelleğine yazar.
// Kombin isteklerinde embedding hesaplanmadığı için kural veya model değişince bir kez çalıştırılmalı.
//   npx tsx scripts/embed-knowledge.ts
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectToDatabase } from '../backend/db.js';
import { warmRuleEmbeddings } from '../backend/knowledge/embeddingStore.js';
import { KNOWLEDGE_RULES } from '../backend/knowledge/rules.js';

async function main() {
  await connectToDatabase();
  let total = 0;
  for (let round = 0; round < 20; round++) {
    const { computed, missing } = await warmRuleEmbeddings(25);
    total += computed;
    console.log(`Tur ${round + 1}: ${computed} hesaplandı, ${missing} eksik.`);
    if (missing === 0) break;
    if (computed === 0) {
      console.error('Hiçbir embedding hesaplanamadı (kota veya API anahtarı sorunu olabilir).');
      process.exitCode = 1;
      break;
    }
  }
  console.log(`Toplam ${total} yeni embedding, ${KNOWLEDGE_RULES.length} kural.`);
  await mongoose.disconnect();
}

main().catch(async err => {
  console.error(err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
