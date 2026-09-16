import { EmbeddingCacheModel } from '../db.js';
import { embed, embeddingCacheKey } from '../ai/gemini.js';
import { KNOWLEDGE_RULES, KnowledgeRule } from './rules.js';
import { ruleEmbeddingText } from './retrieval.js';

/** Metin embedding'ini MongoDB önbelleğinden okur; yoksa hesaplayıp kaydeder. */
export async function getTextEmbedding(text: string, label: string): Promise<number[] | null> {
  const trimmed = text.trim().slice(0, 2000);
  if (!trimmed) return null;
  const key = embeddingCacheKey(trimmed);
  const cached: any = await EmbeddingCacheModel.findOne({ key } as any).lean();
  if (cached?.vector?.length) return cached.vector;
  const vector = await embed({ text: trimmed }, label);
  if (vector) {
    await EmbeddingCacheModel.updateOne({ key } as any, { $set: { key, vector } }, { upsert: true }).catch(() => undefined);
  }
  return vector;
}

/**
 * Bilgi tabanı kurallarının embedding'lerini yükler. Eksik olanlardan en fazla `computeMissing` tanesini
 * bu istek sırasında hesaplar; önbellek zamanla kendiliğinden ısınır. Tamamını önceden hesaplamak için:
 * `npx tsx scripts/embed-knowledge.ts`
 */
export async function loadRuleEmbeddings(computeMissing = 2, rules: KnowledgeRule[] = KNOWLEDGE_RULES): Promise<Map<string, number[]>> {
  const keys = rules.map(rule => ({ rule, key: embeddingCacheKey(ruleEmbeddingText(rule)) }));
  const docs: any[] = await EmbeddingCacheModel.find({ key: { $in: keys.map(k => k.key) } } as any).lean();
  const byKey = new Map(docs.map(d => [d.key, d.vector as number[]]));
  const result = new Map<string, number[]>();
  let computed = 0;
  for (const { rule, key } of keys) {
    const vector = byKey.get(key);
    if (vector?.length) {
      result.set(rule.id, vector);
    } else if (computed < computeMissing) {
      computed++;
      const fresh = await getTextEmbedding(ruleEmbeddingText(rule), 'knowledge_rule');
      if (fresh) result.set(rule.id, fresh);
    }
  }
  return result;
}
