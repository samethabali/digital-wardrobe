import type { DailyPickResponse, GenerateOutfitResponse } from '../shared/api.js';
import { DailyPickModel, PushSubscriptionModel, UserModel } from './db.js';
import { generateOutfitsForUser } from './engine/generate.js';
import { localDate } from './time.js';
import { sendPushToUser } from './push.js';
import { hasConsent } from './preferences.js';

export interface DailyPickOptions {
  /** Önbelleği yok say ve yeniden üret */
  refresh?: boolean;
  /** full: AI stilist (kullanıcı açınca); deterministic: kota harcamayan kural motoru (zamanlanmış görev) */
  mode?: 'full' | 'deterministic';
  date?: string;
}

/** Günlük kombin isteği: son kullanılan konumdaki bugünün havasına göre gündelik kombin. */
export const DAILY_REQUEST = { event: 'Gündelik', dressiness: 3 } as const;

/**
 * Kullanıcının bugünkü kombin önerisini döndürür. Gün başına bir kez üretilir ve 7 gün saklanır
 * (Türkiye saatine göre gün değişince yenisi üretilir).
 */
export async function getDailyPick(user: any, options: DailyPickOptions = {}): Promise<DailyPickResponse> {
  const date = options.date || localDate();
  if (!options.refresh) {
    const cached: any = await DailyPickModel.findOne({ userId: user._id, date } as any).lean();
    if (cached?.payload) return { date, cached: true, result: cached.payload as GenerateOutfitResponse };
  }
  const result = await generateOutfitsForUser(user, DAILY_REQUEST, { mode: options.mode || 'full', picks: 3, useLastLocation: true });
  await DailyPickModel.updateOne(
    { userId: user._id, date } as any,
    { $set: { payload: result, createdAt: new Date() } },
    { upsert: true },
  );
  return { date, cached: false, result };
}

export function dailyPushPayload(pick: DailyPickResponse) {
  const outfit = pick.result.outfits[0];
  const weather = pick.result.weather;
  const weatherText = weather ? `${weather.locationLabel} ${Math.round(weather.temperatureC)}°C, ${weather.condition.toLocaleLowerCase('tr-TR')}` : null;
  const items = outfit.items.map(i => i.name).slice(0, 3).join(' + ');
  return {
    title: `Bugünün kombini: ${outfit.title}`,
    body: [weatherText, items].filter(Boolean).join(' · ').slice(0, 180),
    url: '/?gunluk=1',
    tag: `daily-${pick.date}`,
  };
}

export interface DailyRunSummary {
  users: number;
  sent: number;
  skipped: number;
  failed: number;
  timedOut: boolean;
}

/**
 * Zamanlanmış görev: bildirim rızası ve aboneliği olan kullanıcılara günlük kombini gönderir.
 * Kural motoru kullanılır (kota harcamaz); süre bütçesi aşılırsa kalan kullanıcılar bir sonraki çalıştırmaya kalır.
 */
export async function runDailyPicks(options: { budgetMs?: number; limit?: number } = {}): Promise<DailyRunSummary> {
  const started = Date.now();
  const budget = options.budgetMs ?? 45_000;
  const userIds: unknown[] = await (PushSubscriptionModel as any).distinct('userId');
  const users: any[] = await UserModel.find({ _id: { $in: userIds }, 'consents.push.granted': true } as any)
    .limit(options.limit ?? 200).lean();
  const summary: DailyRunSummary = { users: users.length, sent: 0, skipped: 0, failed: 0, timedOut: false };
  const today = localDate();

  for (const user of users) {
    if (Date.now() - started > budget) { summary.timedOut = true; break; }
    if (!hasConsent(user, 'push')) { summary.skipped++; continue; }
    try {
      const alreadySent: any = await DailyPickModel.findOne({ userId: user._id, date: today, pushedAt: { $exists: true } } as any).lean();
      if (alreadySent) { summary.skipped++; continue; }
      const pick = await getDailyPick(user, { mode: 'deterministic', date: today });
      const result = await sendPushToUser(user._id, dailyPushPayload(pick));
      await DailyPickModel.updateOne({ userId: user._id, date: today } as any, { $set: { pushedAt: new Date() } });
      if (result.sent > 0) summary.sent++; else summary.skipped++;
    } catch (err: any) {
      summary.failed++;
      console.warn('[Daily] Günlük kombin üretilemedi:', err?.message);
    }
  }
  return summary;
}
