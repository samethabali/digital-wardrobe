import { EmbeddingCacheModel } from '../db.js';
import { embed, embeddingCacheKey } from '../ai/gemini.js';
import { KNOWLEDGE_RULES, KnowledgeRule } from './rules.js';
import { ruleEmbeddingText } from './retrieval.js';

/** Metin embedding'ini MongoDB önbelleğinden okur; yoksa hesaplayıp kaydeder. */
export async function getTextEmbedding(text: string, label: string, timeoutMs?: number): Promise<number[] | null> {
  const trimmed = text.trim().slice(0, 2000);
  if (!trimmed) return null;
  const key = embeddingCacheKey(trimmed);
  const cached: any = await EmbeddingCacheModel.findOne({ key } as any).lean();
  if (cached?.vector?.length) return cached.vector;
  const vector = await embed({ text: trimmed }, label, timeoutMs);
  if (vector) {
    await EmbeddingCacheModel.updateOne({ key } as any, { $set: { key, vector } }, { upsert: true }).catch(() => undefined);
  }
  return vector;
}

/**
 * Bilgi tabanı kurallarının embedding'lerini yükler. Eksik olanlardan en fazla `computeMissing` tanesini hesaplar.
 * Kullanıcı isteklerinde 0 verilir (gecikme eklenmez); önbelleği doldurmak için `npx tsx scripts/embed-knowledge.ts`
 * veya günlük zamanlanmış görev (`warmRuleEmbeddings`) kullanılır.
 */
export async function loadRuleEmbeddings(computeMissing = 0, rules: KnowledgeRule[] = KNOWLEDGE_RULES): Promise<Map<string, number[]>> {
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

/** Eksik kural embedding'lerinden en fazla `limit` tanesini hesaplar; kaç kuralın hâlâ eksik olduğunu döndürür. */
export async function warmRuleEmbeddings(limit = 40, rules: KnowledgeRule[] = KNOWLEDGE_RULES): Promise<{ computed: number; missing: number }> {
  const before = await loadRuleEmbeddings(0, rules);
  const after = await loadRuleEmbeddings(limit, rules);
  return { computed: after.size - before.size, missing: rules.length - after.size };
}
