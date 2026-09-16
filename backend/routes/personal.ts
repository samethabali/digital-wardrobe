import express from 'express';
import { ItemModel, UserModel, WearLogModel } from '../db.js';
import { authenticateToken, byUser, rateLimit, RATE_LIMITS, sendError } from '../http.js';
import { handleFeedback, sanitizeFeedback } from '../feedback.js';
import {
  computeWardrobeStats, deleteWear, listWear, parseRange, recordWear, sanitizeWearInput,
} from '../wearLog.js';
import { addDays, localDate } from '../time.js';
import { getDailyPick, runDailyPicks } from '../daily.js';
import { planTrip, sanitizeTripRequest } from '../engine/trip.js';
import { pushPublicKey, removeSubscription, sanitizeSubscription, saveSubscription } from '../push.js';
import { hasConsent } from '../preferences.js';
import {
  analyzePersonalColor, sanitizeSelfie, sanitizeStyleProfile, toStyleProfileDTO,
} from '../personalColor.js';
import { getCronSecret } from '../config.js';
import { warmRuleEmbeddings } from '../knowledge/embeddingStore.js';
import { RequestError } from '../engine/request.js';

async function loadUser(req: any) {
  const user = await UserModel.findOne({ _id: req.user.id } as any);
  if (!user) throw new RequestError('Kullanıcı bulunamadı.', 404);
  return user;
}

export function personalRoutes(): express.Router {
  const router = express.Router();

  // ─── Geri bildirim ───────────────────────────────────────────────────────
  router.post('/api/feedback', authenticateToken, rateLimit('feedback', RATE_LIMITS.feedback, byUser), async (req: any, res) => {
    try {
      const feedback = sanitizeFeedback(req.body);
      const user = await loadUser(req);
      const outcome = await handleFeedback(user, feedback);
      res.json({ success: true, ...outcome });
    } catch (err) {
      sendError(res, err, 'Geri bildirim kaydedilemedi', 'Feedback');
    }
  });

  // ─── Giyim günlüğü ───────────────────────────────────────────────────────
  router.get('/api/wear-log', authenticateToken, async (req: any, res) => {
    try {
      const { from, to } = parseRange(req.query);
      res.json({ from, to, entries: await listWear(req.user.id, from, to) });
    } catch (err) {
      sendError(res, err, 'Giyim günlüğü alınamadı.', 'Wear Log');
    }
  });

  router.post('/api/wear-log', authenticateToken, rateLimit('wearlog', RATE_LIMITS.wearLog, byUser), async (req: any, res) => {
    try {
      const entry = await recordWear(req.user.id, sanitizeWearInput(req.body));
      res.json({ success: true, entry });
    } catch (err) {
      sendError(res, err, 'Giyim kaydı eklenemedi.', 'Wear Log');
    }
  });

  router.delete('/api/wear-log/:id', authenticateToken, async (req: any, res) => {
    try {
      const deleted = await deleteWear(req.user.id, String(req.params.id));
      if (!deleted) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
      res.json({ success: true });
    } catch (err) {
      sendError(res, err, 'Giyim kaydı silinemedi.', 'Wear Log');
    }
  });

  router.get('/api/stats', authenticateToken, async (req: any, res) => {
    try {
      const today = localDate();
      const [items, logs] = await Promise.all([
        ItemModel.find({ userId: req.user.id } as any).select('+embedding').lean(),
        WearLogModel.find({ userId: req.user.id, date: { $gte: addDays(today, -365) } } as any).select('date itemIds').lean(),
      ]);
      res.json(computeWardrobeStats(items as any[], logs as any[], today));
    } catch (err) {
      sendError(res, err, 'İstatistikler hesaplanamadı.', 'Stats');
    }
  });

  // ─── Günlük öneri ve seyahat ─────────────────────────────────────────────
  router.get('/api/daily-pick', authenticateToken, rateLimit('daily', RATE_LIMITS.dailyPick, byUser), async (req: any, res) => {
    try {
      const user = await loadUser(req);
      res.json(await getDailyPick(user, { refresh: req.query.refresh === '1' }));
    } catch (err) {
      sendError(res, err, 'Günün kombini hazırlanamadı.', 'Daily Pick');
    }
  });

  router.post('/api/trips/plan', authenticateToken, rateLimit('trip', RATE_LIMITS.tripPlan, byUser), async (req: any, res) => {
    try {
      const trip = sanitizeTripRequest(req.body);
      const user = await loadUser(req);
      res.json(await planTrip(user, trip));
    } catch (err) {
      sendError(res, err, 'Seyahat planı oluşturulamadı.', 'Trip');
    }
  });

  // ─── Web push ────────────────────────────────────────────────────────────
  router.get('/api/push/public-key', authenticateToken, (_req, res) => {
    const publicKey = pushPublicKey();
    res.json({ enabled: Boolean(publicKey), publicKey });
  });

  router.post('/api/push/subscribe', authenticateToken, rateLimit('push', RATE_LIMITS.push, byUser), async (req: any, res) => {
    try {
      if (!pushPublicKey()) return res.status(503).json({ error: 'Bildirimler bu sunucuda etkin değil.' });
      const user = await loadUser(req);
      if (!hasConsent(user, 'push')) return res.status(403).json({ error: 'Bildirim almak için önce Hesap Ayarları\'ndan izin vermelisin.' });
      await saveSubscription(user._id, sanitizeSubscription(req.body));
      res.json({ success: true });
    } catch (err) {
      sendError(res, err, 'Bildirim aboneliği kaydedilemedi.', 'Push');
    }
  });

  router.delete('/api/push/subscribe', authenticateToken, async (req: any, res) => {
    try {
      const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint : undefined;
      await removeSubscription(req.user.id, endpoint);
      res.json({ success: true });
    } catch (err) {
      sendError(res, err, 'Abonelik kaldırılamadı.', 'Push');
    }
  });

  // ─── Stil profili ve kişisel renk ────────────────────────────────────────
  router.get('/api/style/profile', authenticateToken, async (req: any, res) => {
    try {
      res.json(await toStyleProfileDTO(await loadUser(req)));
    } catch (err) {
      sendError(res, err, 'Stil profili alınamadı.', 'Style Profile');
    }
  });

  router.put('/api/style/profile', authenticateToken, async (req: any, res) => {
    try {
      const update = sanitizeStyleProfile(req.body);
      const set = Object.fromEntries(Object.entries(update).map(([k, v]) => [`styleProfile.${k}`, v]));
      const user = await UserModel.findOneAndUpdate({ _id: req.user.id } as any, { $set: set }, { returnDocument: 'after' } as any);
      if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
      res.json(await toStyleProfileDTO(user));
    } catch (err) {
      sendError(res, err, 'Stil profili kaydedilemedi.', 'Style Profile');
    }
  });

  router.post('/api/style/personal-color', authenticateToken, rateLimit('personalColor', RATE_LIMITS.personalColor, byUser), async (req: any, res) => {
    try {
      const user = await loadUser(req);
      if (!hasConsent(user, 'personalColor')) {
        return res.status(403).json({ error: 'Kişisel renk analizi için önce açık rıza vermelisin.' });
      }
      const result = await analyzePersonalColor(sanitizeSelfie(req.body));
      const updated = await UserModel.findOneAndUpdate(
        { _id: req.user.id } as any,
        { $set: { 'styleProfile.personalColor': { ...result, analyzedAt: new Date(result.analyzedAt) } } },
        { returnDocument: 'after' } as any,
      );
      res.json(await toStyleProfileDTO(updated));
    } catch (err) {
      sendError(res, err, 'Renk analizi yapılamadı.', 'Personal Color');
    }
  });

  router.delete('/api/style/personal-color', authenticateToken, async (req: any, res) => {
    try {
      const updated = await UserModel.findOneAndUpdate(
        { _id: req.user.id } as any,
        { $unset: { 'styleProfile.personalColor': '' } },
        { returnDocument: 'after' } as any,
      );
      res.json(await toStyleProfileDTO(updated));
    } catch (err) {
      sendError(res, err, 'Renk analizi silinemedi.', 'Personal Color');
    }
  });

  // ─── Zamanlanmış görev (Vercel Cron) ─────────────────────────────────────
  router.get('/api/cron/daily', async (req, res) => {
    const secret = getCronSecret();
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Yetkisiz.' });
    }
    try {
      const knowledge = await warmRuleEmbeddings(20).catch(() => null);
      const daily = await runDailyPicks({ budgetMs: 40_000 });
      res.json({ success: true, daily, knowledge });
    } catch (err) {
      sendError(res, err, 'Zamanlanmış görev başarısız.', 'Cron');
    }
  });

  return router;
}
