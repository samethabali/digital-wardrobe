import express from 'express';
import { CollabSessionModel, ItemModel, UserModel } from '../db.js';
import { authenticateToken, byUser, rateLimit, RATE_LIMITS, sendError } from '../http.js';
import { generateCollab } from '../engine/collab.js';
import { toItemDTO } from '../engine/items.js';

const OBJECT_ID = /^[a-f0-9]{24}$/i;

function toSessionDTO(s: any) {
  return {
    id: s.id,
    initiatorId: s.initiatorId?.toString(),
    initiatorName: s.initiatorName,
    friendId: s.friendId?.toString(),
    friendName: s.friendName,
    event: s.event,
    effort: s.effort,
    mood: s.mood,
    myOutfit: s.myOutfit,
    friendOutfit: s.friendOutfit,
    compatibilityScore: s.compatibilityScore,
    collabReason: s.collabReason,
    styleHarmony: s.styleHarmony,
    seenByFriend: s.seenByFriend,
    createdAt: s.createdAt,
  };
}

export function socialRoutes(): express.Router {
  const router = express.Router();

  router.get('/api/users/explore', authenticateToken, async (req: any, res) => {
    try {
      const users: any[] = await UserModel.find({ _id: { $ne: req.user.id }, isPrivate: { $ne: true } } as any)
        .select('name username createdAt').sort({ createdAt: -1 } as any).limit(200).lean();
      const counts: any[] = await ItemModel.aggregate([
        { $match: { userId: { $in: users.map(u => u._id) } } },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
      ]);
      const countBy = new Map(counts.map(c => [c._id.toString(), c.count]));
      res.json({
        success: true,
        profiles: users.map(u => ({
          id: u._id.toString(), name: u.name, username: u.username, createdAt: u.createdAt, itemCount: countBy.get(u._id.toString()) || 0,
        })),
      });
    } catch (err) {
      sendError(res, err, 'Keşfet profilleri alınamadı.', 'Explore');
    }
  });

  router.get('/api/users/explore/:userId/wardrobe', authenticateToken, async (req: any, res) => {
    try {
      const targetUserId = req.params.userId;
      if (!OBJECT_ID.test(targetUserId)) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
      const targetUser: any = await UserModel.findOne({ _id: targetUserId } as any);
      if (!targetUser) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
      if (targetUser.isPrivate) return res.status(403).json({ error: 'Bu profil gizlidir ve gardırobuna erişilemez.' });

      const items = await ItemModel.find({ userId: targetUserId } as any).limit(200).sort({ _id: -1 } as any).lean();
      res.json({
        success: true,
        user: { id: targetUser._id.toString(), name: targetUser.name, username: targetUser.username },
        items: items.map(toItemDTO),
      });
    } catch (err) {
      sendError(res, err, 'Gardırop verileri alınamadı.', 'Explore Wardrobe');
    }
  });

  // İki gardırobu kural motoruyla eşleştirip beraber kombin oturumu oluşturur
  router.post('/api/collab/generate', authenticateToken, rateLimit('collab', RATE_LIMITS.collabGenerate, byUser), async (req: any, res) => {
    try {
      const { friendUserId, event, effort, mood } = req.body || {};
      if (typeof friendUserId !== 'string' || !OBJECT_ID.test(friendUserId)) return res.status(400).json({ error: 'Arkadaş ID\'si gereklidir.' });
      if (friendUserId === req.user.id) return res.status(400).json({ error: 'Kendinle beraber kombin oluşturamazsın.' });

      const initiator: any = await UserModel.findOne({ _id: req.user.id } as any);
      if (!initiator) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
      const friend: any = await UserModel.findOne({ _id: friendUserId } as any);
      if (!friend) return res.status(404).json({ error: 'Arkadaş bulunamadı.' });
      if (friend.isPrivate) return res.status(403).json({ error: 'Bu kullanıcının profili gizlidir.' });

      const collabResult = await generateCollab(initiator, friend, req.body);

      const collabId = `collab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const session = await CollabSessionModel.create({
        id: collabId,
        initiatorId: initiator._id,
        initiatorName: initiator.name,
        friendId: friend._id,
        friendName: friend.name,
        event: typeof event === 'string' ? event.slice(0, 60) : 'Gündelik',
        effort: typeof effort === 'number' ? effort : 5,
        mood: typeof mood === 'string' ? mood.slice(0, 30) : 'Rahat',
        myOutfit: collabResult.myOutfit,
        friendOutfit: collabResult.friendOutfit,
        compatibilityScore: collabResult.compatibilityScore,
        collabReason: collabResult.collabReason,
        styleHarmony: collabResult.styleHarmony,
        seenByFriend: false,
      });

      res.json({
        success: true,
        collabId,
        session: toSessionDTO(session),
        myOutfit: collabResult.myOutfit,
        friendOutfit: collabResult.friendOutfit,
        myItems: collabResult.myItems,
        friendItems: collabResult.friendItems,
        compatibilityScore: collabResult.compatibilityScore,
        collabReason: collabResult.collabReason,
        styleHarmony: collabResult.styleHarmony,
        friendName: friend.name,
        initiatorName: initiator.name,
        weather: collabResult.weather,
        warnings: collabResult.warnings,
      });
    } catch (err) {
      sendError(res, err, 'Beraber kombin oluşturulamadı.', 'Collab Generate');
    }
  });

  router.get('/api/collab/inbox', authenticateToken, async (req: any, res) => {
    try {
      const sessions: any[] = await CollabSessionModel.find({ friendId: req.user.id } as any).sort({ createdAt: -1 } as any).limit(20).lean();
      res.json({ success: true, sessions: sessions.map(toSessionDTO), unreadCount: sessions.filter(s => !s.seenByFriend).length });
    } catch (err) {
      sendError(res, err, 'Collab bildirimleri alınamadı.', 'Collab Inbox');
    }
  });

  router.patch('/api/collab/:id/seen', authenticateToken, async (req: any, res) => {
    try {
      const session: any = await CollabSessionModel.findOne({ id: String(req.params.id) } as any);
      if (!session) return res.status(404).json({ error: 'Collab bulunamadı.' });
      // Sadece arkadaş (friendId) okundu işaretleyebilir
      if (session.friendId?.toString() !== req.user.id) return res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
      session.seenByFriend = true;
      await session.save();
      res.json({ success: true });
    } catch (err) {
      sendError(res, err, 'Güncelleme başarısız.', 'Collab Seen');
    }
  });

  router.get('/api/collab/sent', authenticateToken, async (req: any, res) => {
    try {
      const sessions: any[] = await CollabSessionModel.find({ initiatorId: req.user.id } as any).sort({ createdAt: -1 } as any).limit(20).lean();
      res.json({ success: true, sessions: sessions.map(toSessionDTO) });
    } catch (err) {
      sendError(res, err, 'Gönderilen collab\'lar alınamadı.', 'Collab Sent');
    }
  });

  return router;
}
