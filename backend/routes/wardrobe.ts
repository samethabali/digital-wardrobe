import express from 'express';
import type { RequestHandler } from 'express';
import { ItemModel, OutfitModel, UserModel } from '../db.js';
import { authenticateToken, byUser, rateLimit, RATE_LIMITS, sendError } from '../http.js';
import { deleteImages, downloadOwnImage, getOwnedPublicId, withTransformation } from '../cloudinary.js';
import { generateOutfitsForUser } from '../engine/generate.js';
import { analyzeCapsule, CAPSULE_TARGETS, CapsuleTarget } from '../engine/capsule.js';
import { toItemDTO } from '../engine/items.js';
import { analyzeClothingImage, applyAnalysisToItem, createCutout, itemNeedsEnrichment } from '../vision.js';
import { applyEmbedding, computeItemEmbedding, findSimilarItems } from '../embeddings.js';
import { EMBEDDING_MODEL } from '../ai/models.js';
import {
  invalidatesEmbedding, pickItemUpdate, pickNewOutfit, pickOutfitUpdate, withDerivedWeatherMatch,
} from '../itemFields.js';
import { sanitizeContextSummary } from '../feedback.js';
import { recordFeedback } from '../preferences.js';
import { deriveWeatherMatch } from '../../shared/wardrobe.js';
import type { SimilarItemDTO } from '../../shared/api.js';

const newItemId = () => `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const ITEM_ID = /^[\w.:-]{1,100}$/;

function toSimilarDTO(similar: { item: any; similarity: number }[]): SimilarItemDTO[] {
  return similar.map(s => ({
    id: s.item.id,
    name: s.item.name,
    imagePath: s.item.cutoutImagePath || s.item.imagePath,
    similarity: Math.round(s.similarity * 100) / 100,
  }));
}

export interface WardrobeRouteOptions {
  /** multer ara katmanı (canlıda Cloudinary depolaması) */
  uploadMiddleware: RequestHandler;
}

export function wardrobeRoutes({ uploadMiddleware }: WardrobeRouteOptions): express.Router {
  const router = express.Router();

  router.get('/api/wardrobe', authenticateToken, async (req: any, res) => {
    try {
      // Belirli parçalar (kayıtlı kombinler sayfalanmış listede olmayan parçaları bu yolla alır)
      if (typeof req.query.ids === 'string') {
        const ids = req.query.ids.split(',').filter((id: string) => ITEM_ID.test(id)).slice(0, 200);
        const items = ids.length ? await ItemModel.find({ userId: req.user.id, id: { $in: ids } } as any).lean() : [];
        return res.json({ items: items.map(toItemDTO) });
      }
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
      const skip = (page - 1) * limit;
      const [total, items] = await Promise.all([
        ItemModel.countDocuments({ userId: req.user.id } as any),
        ItemModel.find({ userId: req.user.id } as any).skip(skip).limit(limit).sort({ _id: -1 } as any).lean(),
      ]);
      res.json({ items: items.map(toItemDTO), total, page, totalPages: Math.ceil(total / limit), hasMore: page * limit < total });
    } catch (err) {
      sendError(res, err, 'Gardırop alınamadı.', 'Wardrobe');
    }
  });

  router.post('/api/wardrobe/scan', authenticateToken, async (_req, res) => {
    res.json({ success: true, added: 0, message: 'Tarama artık desteklenmiyor (Bulut tabanlı)' });
  });

  router.post('/api/wardrobe/enrich', authenticateToken, rateLimit('enrich', RATE_LIMITS.enrich, byUser), async (req: any, res) => {
    try {
      const items = await ItemModel.find({ userId: req.user.id } as any);
      const targets = items.filter(itemNeedsEnrichment);
      if (targets.length === 0) {
        return res.json({ success: true, enriched: 0, message: 'Tüm öğeler zaten eksiksiz.' });
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      const sendEvent = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);
      sendEvent({ type: 'start', total: targets.length });

      let enriched = 0;
      let failed = 0;
      for (const item of targets as any[]) {
        sendEvent({ type: 'progress', current: enriched + failed + 1, total: targets.length, name: item.name });
        try {
          const downloaded = item.imagePath ? await downloadOwnImage(item.imagePath) : null;
          if (downloaded) {
            const { analysis } = await analyzeClothingImage(downloaded.base64, downloaded.mimeType);
            applyAnalysisToItem(item, analysis);
            item.enrichAttemptedAt = new Date();
            // Tarif değişti: embedding yeniden hesaplanmalı
            item.embedding = undefined;
            item.embeddingModel = undefined;
            await item.save();
            enriched++;
            sendEvent({ type: 'item_done', id: item.id, name: item.name, category: item.category, color: item.color });
          } else {
            item.enrichAttemptedAt = new Date();
            await item.save();
            failed++;
          }
        } catch {
          failed++;
        }
        await new Promise(r => setTimeout(r, 1200));
      }
      sendEvent({ type: 'done', enriched, failed, message: `${enriched} öğe tamamlandı, ${failed} başarısız.` });
      res.end();
    } catch (err) {
      if (res.headersSent) { res.end(); return; }
      sendError(res, err, 'Zenginleştirme başarısız', 'Enrich');
    }
  });

  router.post('/api/analyze-image-base64', authenticateToken, rateLimit('analyze', RATE_LIMITS.analyzeImage, byUser), async (req, res) => {
    try {
      const { base64, mimeType } = req.body || {};
      if (typeof base64 !== 'string' || typeof mimeType !== 'string' || !/^image\/(jpeg|png|webp|heic|heif)$/.test(mimeType)) {
        return res.status(400).json({ error: 'base64 ve geçerli bir mimeType gerekli' });
      }
      const { analysis, model } = await analyzeClothingImage(base64, mimeType);
      res.json({ success: true, analysis, ...analysis, model });
    } catch (err) {
      sendError(res, err, 'Analiz hatası', 'Vision Base64');
    }
  });

  router.get('/api/capsule-analysis', authenticateToken, rateLimit('capsule', RATE_LIMITS.capsuleAnalysis, byUser), async (req: any, res) => {
    try {
      const requested = String(req.query.category || 'any');
      if (!(CAPSULE_TARGETS as readonly string[]).includes(requested)) {
        return res.status(400).json({ error: 'Geçersiz kategori.' });
      }
      const docs = await ItemModel.find({ userId: req.user.id } as any).lean();
      if (docs.length < 5) {
        return res.json({
          insufficient: true,
          message: 'Kapsül gardırop simülasyonu yapabilmek için dolabında en az 5 adet kıyafet bulunmalıdır. Lütfen biraz daha kıyafet ekle!',
        });
      }
      res.json(await analyzeCapsule(docs, requested as CapsuleTarget));
    } catch (err) {
      sendError(res, err, 'Kapsül gardırop analizi oluşturulamadı', 'Capsule');
    }
  });

  router.post('/api/generate-outfit', authenticateToken, rateLimit('generate', RATE_LIMITS.generateOutfit, byUser), async (req: any, res) => {
    try {
      const rawRequest = req.body?.request || req.body;
      const user = await UserModel.findOne({ _id: req.user.id } as any);
      if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
      res.json(await generateOutfitsForUser(user, rawRequest, { mode: 'full' }));
    } catch (err) {
      sendError(res, err, 'Kombin oluşturulamadı', 'Generate Outfit');
    }
  });

  // ─── Parça ekleme ────────────────────────────────────────────────────────
  router.post('/api/wardrobe/upload', authenticateToken, rateLimit('upload', RATE_LIMITS.upload, byUser), uploadMiddleware, async (req: any, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Dosya eksik' });
    const rawUrl = file.path as string;
    const removeUpload = async () => {
      const publicId = getOwnedPublicId(rawUrl, req.user.id);
      if (publicId) await deleteImages([publicId]);
    };

    try {
      let itemData: any = {};
      try {
        itemData = JSON.parse(req.body?.itemData || '{}');
      } catch {
        await removeUpload();
        return res.status(400).json({ error: 'Parça bilgileri okunamadı.' });
      }
      const picked = pickItemUpdate(itemData);
      if ('error' in picked) {
        await removeUpload();
        return res.status(400).json({ error: picked.error });
      }

      // Otomatik format (WebP/AVIF), kalite ve en fazla 1200px genişlik
      const imagePath = rawUrl.replace('/upload/', '/upload/f_auto,q_auto,w_1200/');
      const autoAnalyze = req.body?.autoAnalyze === 'true' || !picked.update.category;
      const warnings: string[] = [];

      const image = await downloadOwnImage(withTransformation(imagePath, 'f_jpg,q_auto,w_768'));
      const doc: any = new ItemModel({
        id: newItemId(),
        userId: req.user.id,
        attributes: {},
        ...picked.update,
        imagePath,
      });

      if (autoAnalyze && image) {
        try {
          const { analysis } = await analyzeClothingImage(image.base64, image.mimeType);
          applyAnalysisToItem(doc, analysis);
          if (!analysis.isClothing) warnings.push('Fotoğrafta bir kıyafet tespit edilemedi; bilgileri kontrol et.');
        } catch (err: any) {
          warnings.push('Otomatik analiz yapılamadı; bilgileri elle tamamlayabilirsin.');
          console.warn('[Upload] Analiz başarısız:', err?.message);
        }
      }
      if (!doc.name) doc.name = String(file.originalname || 'Yeni parça').replace(/\.[^.]+$/, '').slice(0, 80);
      if (!doc.category) doc.category = 'top';
      if (!doc.weatherMatch?.length) doc.weatherMatch = deriveWeatherMatch(doc);

      // Görsel + metin embedding'i: benzer parça uyarısı, stil kümeleri ve puanlayıcı için
      let similarItems: SimilarItemDTO[] = [];
      const vector = image ? await computeItemEmbedding(doc, { base64: image.base64, mimeType: image.mimeType }) : null;
      if (vector) {
        applyEmbedding(doc, vector);
        const existing = await ItemModel.find({ userId: req.user.id, category: doc.category } as any)
          .select('+embedding id name imagePath cutoutImagePath category').lean();
        similarItems = toSimilarDTO(findSimilarItems(vector, existing, { category: doc.category }));
      }

      await doc.save();
      res.json({ success: true, item: toItemDTO(doc), similarItems, warnings });
    } catch (err) {
      await removeUpload().catch(() => undefined);
      sendError(res, err, 'Yükleme başarısız', 'Upload');
    }
  });

  router.delete('/api/wardrobe/:id', authenticateToken, async (req: any, res) => {
    try {
      const item: any = await ItemModel.findOne({ id: req.params.id, userId: req.user.id } as any);
      if (!item) return res.status(404).json({ error: 'Öğe bulunamadı' });

      // Görseller yalnızca kullanıcının kendi klasöründeyse silinir
      const publicIds = [getOwnedPublicId(item.imagePath, req.user.id), getOwnedPublicId(item.cutoutImagePath, req.user.id)].filter(Boolean) as string[];
      await deleteImages(publicIds);

      await ItemModel.deleteOne({ id: req.params.id, userId: req.user.id } as any);
      // Kayıtlı kombinlerde silinen parçaya işaret eden kimlik kalmasın
      await OutfitModel.updateMany({ userId: req.user.id } as any, { $pull: { items: req.params.id } } as any);
      res.json({ success: true });
    } catch (err) {
      sendError(res, err, 'Silme başarısız', 'Delete');
    }
  });

  router.put('/api/wardrobe/:id', authenticateToken, async (req: any, res) => {
    try {
      const picked = pickItemUpdate(req.body);
      if ('error' in picked) return res.status(400).json({ error: picked.error });
      const current: any = await ItemModel.findOne({ id: req.params.id, userId: req.user.id } as any).lean();
      if (!current) return res.status(404).json({ error: 'Bulunamadı' });

      const update = withDerivedWeatherMatch(current, picked.update);
      const operation: any = { $set: update };
      if (invalidatesEmbedding(update)) operation.$unset = { embedding: '', embeddingModel: '' };
      const updated = await ItemModel.findOneAndUpdate({ id: req.params.id, userId: req.user.id } as any, operation, { returnDocument: 'after' } as any).lean();
      res.json({ success: true, item: toItemDTO(updated) });
    } catch (err) {
      sendError(res, err, 'Güncelleme başarısız', 'Update Item');
    }
  });

  // ─── Arka plan kaldırma ──────────────────────────────────────────────────
  router.post('/api/wardrobe/:id/cutout', authenticateToken, rateLimit('cutout', RATE_LIMITS.cutout, byUser), async (req: any, res) => {
    try {
      const item: any = await ItemModel.findOne({ id: req.params.id, userId: req.user.id } as any);
      if (!item) return res.status(404).json({ error: 'Öğe bulunamadı' });
      if (!item.imagePath) return res.status(400).json({ error: 'Parçanın görseli yok.' });
      item.cutoutImagePath = await createCutout(item, req.user.id);
      await item.save();
      res.json({ success: true, item: toItemDTO(item) });
    } catch (err) {
      sendError(res, err, 'Arka plan kaldırılamadı.', 'Cutout');
    }
  });

  router.delete('/api/wardrobe/:id/cutout', authenticateToken, async (req: any, res) => {
    try {
      const item: any = await ItemModel.findOne({ id: req.params.id, userId: req.user.id } as any);
      if (!item) return res.status(404).json({ error: 'Öğe bulunamadı' });
      const publicId = getOwnedPublicId(item.cutoutImagePath, req.user.id);
      if (publicId) await deleteImages([publicId]);
      item.cutoutImagePath = undefined;
      await item.save();
      res.json({ success: true, item: toItemDTO(item) });
    } catch (err) {
      sendError(res, err, 'Görsel kaldırılamadı.', 'Cutout Delete');
    }
  });

  // ─── "Bu parçayla ne giyerim?" ───────────────────────────────────────────
  router.post('/api/wardrobe/:id/pairings', authenticateToken, rateLimit('pairings', RATE_LIMITS.pairings, byUser), async (req: any, res) => {
    try {
      if (!ITEM_ID.test(req.params.id)) return res.status(404).json({ error: 'Öğe bulunamadı' });
      const [user, item] = await Promise.all([
        UserModel.findOne({ _id: req.user.id } as any),
        ItemModel.exists({ id: req.params.id, userId: req.user.id } as any),
      ]);
      if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
      if (!item) return res.status(404).json({ error: 'Öğe bulunamadı' });
      const body = req.body || {};
      const request = { ...body, event: body.event || 'Gündelik', requiredItems: [req.params.id], lockedItems: [], excludedItems: [] };
      // Kural motoru: kota harcamadan anında sonuç; konum verilmezse son konumun havası kullanılır
      res.json(await generateOutfitsForUser(user, request, { mode: 'deterministic', picks: 3, useLastLocation: true }));
    } catch (err) {
      sendError(res, err, 'Bu parça için kombin bulunamadı.', 'Pairings');
    }
  });

  router.get('/api/wardrobe/:id/similar', authenticateToken, async (req: any, res) => {
    try {
      const target: any = await ItemModel.findOne({ id: req.params.id, userId: req.user.id } as any).select('+embedding').lean();
      if (!target) return res.status(404).json({ error: 'Öğe bulunamadı' });
      if (!target.embedding?.length) return res.json({ similarItems: [], embedded: false });
      const others = await ItemModel.find({ userId: req.user.id, category: target.category } as any)
        .select('+embedding id name imagePath cutoutImagePath category').lean();
      res.json({ embedded: true, similarItems: toSimilarDTO(findSimilarItems(target.embedding, others, { category: target.category, excludeId: target.id, threshold: 0.85 })) });
    } catch (err) {
      sendError(res, err, 'Benzer parçalar alınamadı.', 'Similar');
    }
  });

  // Eksik embedding'leri parça parça hesaplar (istemci remaining > 0 oldukça tekrar çağırır)
  router.post('/api/wardrobe/embeddings/backfill', authenticateToken, rateLimit('embeddings', RATE_LIMITS.embeddings, byUser), async (req: any, res) => {
    try {
      const filter = { userId: req.user.id, $or: [{ embedding: { $exists: false } }, { embeddingModel: { $ne: EMBEDDING_MODEL } }] } as any;
      const targets: any[] = await ItemModel.find(filter).select('+embedding +embeddingModel').limit(10);
      const started = Date.now();
      let computed = 0;
      let failed = 0;
      for (const item of targets) {
        if (Date.now() - started > 40_000) break;
        const vector = await computeItemEmbedding(item);
        if (vector) {
          applyEmbedding(item, vector);
          await item.save();
          computed++;
        } else {
          failed++;
        }
      }
      const remaining = await ItemModel.countDocuments(filter);
      res.json({ success: true, computed, failed, remaining });
    } catch (err) {
      sendError(res, err, 'Embedding hesaplanamadı.', 'Embeddings');
    }
  });

  // ─── Kayıtlı kombinler ───────────────────────────────────────────────────
  router.get('/api/outfits', authenticateToken, async (req: any, res) => {
    try {
      const outfits = await OutfitModel.find({ userId: req.user.id } as any).sort({ createdAt: -1 } as any).lean();
      res.json({ outfits });
    } catch (err) {
      sendError(res, err, 'Kombinler alınamadı.', 'Outfits');
    }
  });

  router.post('/api/outfits', authenticateToken, async (req: any, res) => {
    try {
      const picked = pickNewOutfit(req.body);
      if ('error' in picked) return res.status(400).json({ error: picked.error });
      const owned: any[] = await ItemModel.find({ userId: req.user.id, id: { $in: picked.outfit.items as string[] } } as any).select('id').lean();
      const ownedIds = new Set(owned.map(i => i.id));
      const items = (picked.outfit.items as string[]).filter(id => ownedIds.has(id));
      if (items.length === 0) return res.status(400).json({ error: 'Kombindeki parçalar gardırobunda bulunamadı.' });

      const context = sanitizeContextSummary(req.body?.context);
      const newOutfit = await OutfitModel.create({
        ...picked.outfit,
        items,
        context,
        id: `outfit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        userId: req.user.id,
      });

      // Öneriden kaydedilen kombin olumlu geri bildirimdir (yalnızca kişiselleştirme rızası varsa saklanır)
      if (picked.outfit.source !== 'manual') {
        const user = await UserModel.findOne({ _id: req.user.id } as any);
        const generationId = typeof req.body?.generationId === 'string' && /^[\w.:-]{1,100}$/.test(req.body.generationId) ? req.body.generationId : undefined;
        await recordFeedback(user, { type: 'saved', itemIds: items, generationId, context }).catch(() => undefined);
      }
      res.json({ success: true, outfit: newOutfit });
    } catch (err) {
      sendError(res, err, 'Kombin kaydetme başarısız', 'Save Outfit');
    }
  });

  router.delete('/api/outfits/:id', authenticateToken, async (req: any, res) => {
    try {
      await OutfitModel.deleteOne({ id: req.params.id, userId: req.user.id } as any);
      res.json({ success: true });
    } catch (err) {
      sendError(res, err, 'Silme başarısız', 'Delete Outfit');
    }
  });

  router.put('/api/outfits/:id', authenticateToken, async (req: any, res) => {
    try {
      const picked = pickOutfitUpdate(req.body);
      if ('error' in picked) return res.status(400).json({ error: picked.error });
      const updated = await OutfitModel.findOneAndUpdate(
        { id: req.params.id, userId: req.user.id } as any,
        { $set: picked.update },
        { returnDocument: 'after' } as any,
      );
      if (!updated) return res.status(404).json({ error: 'Bulunamadı' });
      res.json({ success: true, outfit: updated });
    } catch (err) {
      sendError(res, err, 'Güncelleme başarısız', 'Update Outfit');
    }
  });

  return router;
}
