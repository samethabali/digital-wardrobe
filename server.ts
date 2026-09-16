import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import mongoose from 'mongoose';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import {
  UserModel, ItemModel, OutfitModel, CollabSessionModel, RateLimitModel,
  FeedbackEventModel, WearLogModel, PreferenceProfileModel, DailyPickModel,
  deletePersonalizationData, connectToDatabase, setOnFirstConnect
} from './backend/db.js';
import {
  cloudinary, getPublicIdFromUrl, getOwnedPublicId, downloadOwnImage, isOwnCloudinaryUrl
} from './backend/cloudinary.js';
import { generateOutfitsForUser } from './backend/engine/generate.js';
import { analyzeCapsule } from './backend/engine/capsule.js';
import { generateCollab } from './backend/engine/collab.js';
import { analyzeClothingImage, applyAnalysisToItem, itemNeedsEnrichment } from './backend/vision.js';
import { toEngineItem } from './backend/engine/items.js';
import { resolveLocation, getWeather } from './backend/weather.js';
import { modelsFor } from './backend/ai/models.js';

dotenv.config();

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Cloudinary Config & Multer ──────────────────────────────
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req: any, file) => {
    const userId = req.user?.id || 'public';
    const uniqueId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const originalNameClean = file.originalname
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_\-.]/g, '');
    const cleanPublicId = originalNameClean.replace(/\.[^/.]+$/, ""); // strip extension
    
    return {
      folder: `digital_wardrobe/${userId}`,
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      public_id: `${cleanPublicId}_${uniqueId}`
    };
  },
});
const upload = multer({ storage: storage, limits: { fileSize: 15 * 1024 * 1024 } });

// JWT Secret — ortam değişkeninde tanımlı olmak zorunda.
function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('[Config] JWT_SECRET ortam değişkeni tanımlı değil veya 32 karakterden kısa. Sunucu başlatılmadı.');
  }
  return secret;
}
const JWT_SECRET = requireJwtSecret();

// Çok kullanıcılı yapıya geçişten önce kalan sahipsiz kayıtların bağlanacağı hesap.
const LEGACY_OWNER_EMAIL = 'samet@aura.com';

// Veri Göçü (Migration) Scripti
async function runMigration() {
  try {
    // Herhangi bir şekilde kullanıcı adı (username) olmayan kullanıcıları güncelle
    const usersWithoutUsername = await UserModel.find({ username: { $exists: false } } as any);
    for (const u of usersWithoutUsername) {
      const emailPrefix = u.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      const uniqueSuffix = Math.random().toString(36).slice(2, 6);
      (u as any).username = `${emailPrefix}_${uniqueSuffix}`;
      await u.save();
      console.log(`[Migration] ${u.email} kullanıcısına default kullanıcı adı (${(u as any).username}) tanımlandı.`);
    }

    // Herhangi bir şekilde isPrivate alanı olmayan kullanıcıları güncelle
    const usersWithoutPrivacy = await UserModel.find({ isPrivate: { $exists: false } } as any);
    if (usersWithoutPrivacy.length > 0) {
      await UserModel.updateMany({ isPrivate: { $exists: false } } as any, { $set: { isPrivate: false } });
      console.log(`[Migration] ${usersWithoutPrivacy.length} kullanıcının gizlilik ayarı varsayılan (false) yapıldı.`);
    }

    const itemsWithoutUser = await ItemModel.find({ userId: { $exists: false } } as any);
    const outfitsWithoutUser = await OutfitModel.find({ userId: { $exists: false } } as any);
    if (itemsWithoutUser.length === 0 && outfitsWithoutUser.length === 0) return;

    const legacyOwner = await UserModel.findOne({ email: LEGACY_OWNER_EMAIL } as any);
    if (!legacyOwner) {
      console.warn(`[Migration] ${LEGACY_OWNER_EMAIL} hesabı bulunamadı; sahipsiz kayıtlar bağlanmadan bırakıldı.`);
      return;
    }

    // userId'si olmayan gardırop öğelerini güncelle
    if (itemsWithoutUser.length > 0) {
      console.log(`[Migration] ${itemsWithoutUser.length} adet sahipsiz gardırop öğesi ${LEGACY_OWNER_EMAIL} hesabına bağlanıyor...`);
      await ItemModel.updateMany({ userId: { $exists: false } } as any, { $set: { userId: legacyOwner._id } });
      console.log('[Migration] Gardırop öğeleri başarıyla güncellendi.');
    }

    // userId'si olmayan kombinleri güncelle
    if (outfitsWithoutUser.length > 0) {
      console.log(`[Migration] ${outfitsWithoutUser.length} adet sahipsiz kombin ${LEGACY_OWNER_EMAIL} hesabına bağlanıyor...`);
      await OutfitModel.updateMany({ userId: { $exists: false } } as any, { $set: { userId: legacyOwner._id } });
      console.log('[Migration] Kombinler başarıyla güncellendi.');
    }
  } catch (err) {
    console.error('[Migration] Hata oluştu:', err);
  }
}

// İlk bağlantıda veritabanı göçünü (migration) arka planda çalıştır
setOnFirstConnect(runMigration);
connectToDatabase().catch(err => console.error('[MongoDB] İlk bağlantı hatası:', err));

// ─── Gemini Vision: Görsel Analizi ────────────────────────────────────────
async function analyzeImageData(base64: string, mimeType: string) {
  try {
    const { analysis } = await analyzeClothingImage(base64, mimeType);
    return analysis;
  } catch (err) {
    console.error('[Vision] Analiz hatası:', err);
    return null;
  }
}

async function analyzeImageUrl(url: string) {
  try {
    const downloaded = await downloadOwnImage(url);
    if (!downloaded) return null;
    return analyzeImageData(downloaded.base64, downloaded.mimeType);
  } catch (e) {
    console.error('[Vision] Fotoğraf indirilirken hata:', e);
    return null;
  }
}

// ─── Weather API (Open-Meteo) ─────────────────────────────────────────────
async function getWeatherForLocation(location: string): Promise<string | null> {
  try {
    const resolved = await resolveLocation(location);
    if (!resolved) return null;
    const weather = await getWeather(resolved);
    return `${resolved.label}: ${weather.temperatureC}°C, ${weather.condition}`;
  } catch (error) {
    console.error('[Weather API] Hata:', error);
    return null;
  }
}

// ─── Server ───────────────────────────────────────────────────────────────
const app = express();
const PORT = 3000;

// ─── Güvenlik (CORS) ─────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.APP_URL,
  'https://samethabali.github.io',
  'https://aura-mobile.expo.app',
  'exp://aura-mobile.expo.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8081',
  'exp://localhost:8081',
];

app.use(cors({
  origin: function(origin, callback) {
    const isVercel = origin && origin.endsWith('.vercel.app');
    
    // Genişletilmiş Mobil Ağ Geçitleri (Local IPs: 192.168.x.x, 172.x.x.x, 10.x.x.x)
    const isLocalIp = origin && (
      origin.startsWith('http://192.168.') || origin.startsWith('exp://192.168.') ||
      origin.startsWith('http://172.') || origin.startsWith('exp://172.') ||
      origin.startsWith('http://10.') || origin.startsWith('exp://10.')
    );
    
    if (!origin || allowedOrigins.includes(origin) || isVercel || isLocalIp) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Engellenen origin: ${origin}`);
      // callback(new Error(...)) Express'i 500 ile çökerttiği için, null ve false dönerek
      // Express'in çökmesini engelliyoruz. İstemci doğal olarak CORS kuralı gereği engellenecektir.
      callback(null, false);
    }
  }
}));

app.use(express.json({ limit: '20mb' })); // Mobil kamera fotoğrafları base64'te ~10-15 MB olabilir

// Her API isteğinde veritabanı bağlantisini garantileyen Serverless-Uyumlu Middleware
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (err) {
    console.error('[MongoDB Middleware] Bağlantı kurulamadı:', err);
    res.status(500).json({ error: 'Veritabanı bağlantısı kurulamadı. Lütfen daha sonra tekrar deneyin.' });
  }
});

app.use((req, res, next) => { console.log(`[Server] ${req.method} ${req.url}`); next(); });

// Authentication Middleware
function authenticateToken(req: any, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Erişim engellendi. Token eksik.' });
  }

  jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Geçersiz veya süresi dolmuş token.' });
    }
    req.user = user;
    next();
  });
}

// ─── İstek Sınırlama (Rate Limit) ───────────────────────────────────────────
// Sayaçlar MongoDB'de tutulur; böylece Vercel'deki tüm serverless örnekleri aynı sınırı paylaşır.
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const RATE_LIMITS = {
  register:        { max: 10, windowMs: HOUR },       // IP başına
  login:           { max: 10, windowMs: 15 * MINUTE }, // IP + e-posta başına
  generateOutfit:  { max: 60, windowMs: HOUR },       // Kullanıcı başına (aşağıdakilerin hepsi)
  analyzeImage:    { max: 60, windowMs: HOUR },
  upload:          { max: 60, windowMs: HOUR },
  capsuleAnalysis: { max: 20, windowMs: HOUR },
  collabGenerate:  { max: 20, windowMs: HOUR },
  enrich:          { max: 5,  windowMs: HOUR },
};

// Vercel istemci IP'sini x-real-ip başlığına kendisi yazar; istemci bu değeri taklit edemez.
function getClientIp(req: express.Request): string {
  const realIp = req.headers['x-real-ip'];
  if (process.env.VERCEL && typeof realIp === 'string' && realIp) return realIp;
  return req.socket.remoteAddress || 'unknown';
}

async function incrementRateCounter(key: string, expiresAt: Date) {
  const update = { $inc: { count: 1 }, $setOnInsert: { expiresAt } };
  const options = { upsert: true, returnDocument: 'after' } as any;
  try {
    return await RateLimitModel.findOneAndUpdate({ key } as any, update, options);
  } catch (err: any) {
    // Aynı pencerenin ilk iki isteği eşzamanlı gelirse biri E11000 alır; kayıt artık var, tekrar denemek yeterli.
    if (err?.code === 11000) return await RateLimitModel.findOneAndUpdate({ key } as any, update, options);
    throw err;
  }
}

function rateLimit(bucket: string, limit: { max: number; windowMs: number }, getIdentity: (req: any) => string) {
  return async (req: any, res: express.Response, next: express.NextFunction) => {
    const windowStart = Math.floor(Date.now() / limit.windowMs) * limit.windowMs;
    const windowEnd = windowStart + limit.windowMs;
    try {
      const counter: any = await incrementRateCounter(`${bucket}:${getIdentity(req)}:${windowStart}`, new Date(windowEnd));
      if (counter.count > limit.max) {
        const retryAfterSec = Math.ceil((windowEnd - Date.now()) / 1000);
        res.setHeader('Retry-After', String(retryAfterSec));
        return res.status(429).json({ error: `Çok fazla istek gönderdin. Lütfen ${Math.ceil(retryAfterSec / 60)} dakika sonra tekrar dene.` });
      }
      next();
    } catch (err) {
      console.error(`[RateLimit] ${bucket} sayacı güncellenemedi:`, err);
      res.status(503).json({ error: 'İstek şu an işlenemiyor. Lütfen biraz sonra tekrar dene.' });
    }
  };
}

const byUser = (req: any) => req.user.id;
const byIp = (req: any) => getClientIp(req);
const byIpAndEmail = (req: any) => `${getClientIp(req)}:${String(req.body?.email || '').trim().toLowerCase()}`;

// ─── Teşhis Hattı (Sadece Localhost) ─────────────────────────
// Canlıda kapalı: kimlik doğrulaması yok.
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.get('/api/debug-models', async (_req, res) => {
    try {
      res.json({
        stylist: modelsFor('stylist'),
        vision: modelsFor('vision'),
        light: modelsFor('light')
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}

// ─── AUTH ENDPOINTS ──────────────────────────────────────────────────────────
app.post('/api/auth/register', rateLimit('register', RATE_LIMITS.register, byIp), async (req, res) => {
  try {
    let { email, password, name, username } = req.body;
    if (!email || !password || !name || !username) {
      return res.status(400).json({ error: 'Lütfen tüm alanları doldurun.' });
    }

    // Mobil klavye/otomatik düzeltme kaynaklı görünmez boşlukların ve karakterlerin temizliği
    email = String(email).trim().toLowerCase();
    password = String(password).trim();
    name = String(name).trim();
    const cleanUsername = String(username).trim().toLowerCase().replace(/\s+/g, '');

    if (!email || !password || !name || !cleanUsername) {
      return res.status(400).json({ error: 'Lütfen tüm alanları geçerli değerlerle doldurun.' });
    }

    if (cleanUsername.length < 3) {
      return res.status(400).json({ error: 'Kullanıcı adı en az 3 karakter olmalıdır.' });
    }

    const existingUser = await UserModel.findOne({ email } as any);
    if (existingUser) {
      return res.status(400).json({ error: 'Bu e-posta adresi zaten kullanımda.' });
    }

    const existingUsername = await UserModel.findOne({ username: cleanUsername } as any);
    if (existingUsername) {
      return res.status(400).json({ error: 'Bu kullanıcı adı zaten alınmış.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = new UserModel({
      email: email.toLowerCase(),
      username: cleanUsername,
      passwordHash,
      name,
      createdAt: new Date()
    });

    await newUser.save();
    
    const token = jwt.sign(
      { id: newUser._id.toString(), email: newUser.email, username: newUser.username, name: newUser.name, isPrivate: false },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: newUser._id.toString(),
        email: newUser.email,
        username: newUser.username,
        name: newUser.name,
        isPrivate: false
      }
    });
  } catch (err) {
    console.error('[Register] Hata:', err);
    res.status(500).json({ error: 'Kayıt işlemi başarısız oldu.' });
  }
});

app.post('/api/auth/login', rateLimit('login', RATE_LIMITS.login, byIpAndEmail), async (req, res) => {
  try {
    let { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'E-posta ve şifre gereklidir.' });
    }

    // Mobil klavye/otomatik düzeltme kaynaklı görünmez boşlukların ve karakterlerin temizliği
    email = String(email).trim().toLowerCase();
    password = String(password).trim();

    if (!email || !password) {
      return res.status(400).json({ error: 'E-posta ve şifre boş bırakılamaz.' });
    }

    const user = await UserModel.findOne({ email } as any);
    if (!user) {
      return res.status(401).json({ error: 'Hatalı e-posta veya şifre.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Hatalı e-posta veya şifre.' });
    }

    const token = jwt.sign(
      { id: user._id.toString(), email: user.email, username: (user as any).username || '', name: user.name, isPrivate: (user as any).isPrivate || false },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        username: (user as any).username || '',
        name: user.name,
        isPrivate: (user as any).isPrivate || false
      }
    });
  } catch (err) {
    console.error('[Login] Hata:', err);
    res.status(500).json({ error: 'Giriş işlemi başarısız oldu.' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req: any, res) => {
  try {
    const user = await UserModel.findOne({ _id: req.user.id } as any);
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    res.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        username: (user as any).username || '',
        name: user.name,
        isPrivate: (user as any).isPrivate || false
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

app.put('/api/auth/profile', authenticateToken, async (req: any, res) => {
  try {
    const { email, username, name, password, isPrivate } = req.body;
    const user = await UserModel.findOne({ _id: req.user.id } as any);
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    if (email && email.toLowerCase() !== user.email) {
      const existingEmail = await UserModel.findOne({ email: email.toLowerCase() } as any);
      if (existingEmail) return res.status(400).json({ error: 'Bu e-posta zaten kullanımda.' });
      user.email = email.toLowerCase();
    }

    if (username && username.trim().toLowerCase() !== (user as any).username) {
      const cleanUsername = username.trim().toLowerCase().replace(/\s+/g, '');
      if (cleanUsername.length < 3) return res.status(400).json({ error: 'Kullanıcı adı en az 3 karakter olmalıdır.' });
      const existingUsername = await UserModel.findOne({ username: cleanUsername } as any);
      if (existingUsername) return res.status(400).json({ error: 'Bu kullanıcı adı zaten alınmış.' });
      (user as any).username = cleanUsername;
    }

    if (name) {
      user.name = name;
    }

    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır.' });
      user.passwordHash = await bcrypt.hash(password, 10);
    }

    if (typeof isPrivate === 'boolean') {
      (user as any).isPrivate = isPrivate;
    }

    await user.save();

    const token = jwt.sign(
      { id: user._id.toString(), email: user.email, username: (user as any).username, name: user.name, isPrivate: (user as any).isPrivate },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        username: (user as any).username,
        name: user.name,
        isPrivate: (user as any).isPrivate
      }
    });
  } catch (err) {
    console.error('[Profile Update] Hata:', err);
    res.status(500).json({ error: 'Profil güncellenemedi.' });
  }
});

app.delete('/api/auth/profile', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;

    // 1) Görselleri bul
    const items = await ItemModel.find({ userId } as any);
    const publicIds = items
      .map(item => getOwnedPublicId(item.imagePath, userId))
      .filter(Boolean) as string[];

    // 2) Cloudinary'den görselleri sil
    if (publicIds.length > 0) {
      console.log(`[Account Delete] ${publicIds.length} adet görsel Cloudinary'den siliniyor...`);
      try {
        await cloudinary.api.delete_resources(publicIds);
      } catch (cloudinaryErr) {
        console.error('[Account Delete] Cloudinary görselleri silinirken hata:', cloudinaryErr);
      }
    }

    // 3) MongoDB'den kıyafetleri, kombinleri ve kişiselleştirme/geri bildirim verilerini sil
    await ItemModel.deleteMany({ userId } as any);
    await OutfitModel.deleteMany({ userId } as any);
    await deletePersonalizationData(userId);

    // 4) Kullanıcıyı sil
    await UserModel.deleteOne({ _id: userId } as any);

    console.log(`[Account Delete] ${req.user.email} hesabı ve tüm verileri silindi.`);
    res.json({ success: true, message: 'Hesabınız ve tüm verileriniz başarıyla silindi.' });
  } catch (err) {
    console.error('[Account Delete] Hata:', err);
    res.status(500).json({ error: 'Hesap silme işlemi başarısız oldu.' });
  }
});

// ─── EXPLORE SOCIAL NETWORKING ENDPOINTS ───────────────────────────────────────
app.get('/api/users/explore', authenticateToken, async (req: any, res) => {
  try {
    const users = await UserModel.find({
      _id: { $ne: req.user.id },
      isPrivate: { $ne: true }
    } as any).select('-passwordHash').sort({ createdAt: -1 } as any);

    const exploreProfiles = await Promise.all(users.map(async (u: any) => {
      const itemCount = await ItemModel.countDocuments({ userId: u._id } as any);
      return {
        id: u._id.toString(),
        name: u.name,
        username: (u as any).username,
        createdAt: u.createdAt,
        itemCount
      };
    }));

    res.json({ success: true, profiles: exploreProfiles });
  } catch (err) {
    console.error('[Explore] Error:', err);
    res.status(500).json({ error: 'Keşfet profilleri alınamadı.' });
  }
});

app.get('/api/users/explore/:userId/wardrobe', authenticateToken, async (req: any, res) => {
  try {
    const targetUserId = req.params.userId;
    const targetUser = await UserModel.findOne({ _id: targetUserId } as any);
    if (!targetUser) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    }

    if ((targetUser as any).isPrivate) {
      return res.status(403).json({ error: 'Bu profil gizlidir ve gardırobuna erişilemez.' });
    }

    const items = await ItemModel.find({ userId: targetUserId } as any).limit(200).sort({ _id: -1 } as any);

    res.json({
      success: true,
      user: {
        id: targetUser._id.toString(),
        name: targetUser.name,
        username: (targetUser as any).username,
      },
      items
    });
  } catch (err) {
    console.error('[Explore Wardrobe] Error:', err);
    res.status(500).json({ error: 'Gardırop verileri alınamadı.' });
  }
});

// ─── COLLAB (BERABER KOMBİN) ENDPOINTS ─────────────────────────────────────

// POST /api/collab/generate — İki gardırobu AI ile eşleştirip collab session oluştur
app.post('/api/collab/generate', authenticateToken, rateLimit('collab', RATE_LIMITS.collabGenerate, byUser), async (req: any, res) => {
  try {
    const { friendUserId, event, effort, mood, ignoreWeather, location } = req.body;
    if (!friendUserId) return res.status(400).json({ error: 'Arkadaş ID\'si gereklidir.' });

    const initiator = await UserModel.findOne({ _id: req.user.id } as any);
    if (!initiator) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    const friend = await UserModel.findOne({ _id: friendUserId } as any);
    if (!friend) return res.status(404).json({ error: 'Arkadaş bulunamadı.' });
    if ((friend as any).isPrivate) {
      return res.status(403).json({ error: 'Bu kullanıcının profili gizlidir.' });
    }

    const collabResult = await generateCollab(initiator, friend, {
      event, effort, mood, ignoreWeather, location
    });

    const collabId = `collab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const session = new CollabSessionModel({
      id: collabId,
      initiatorId: initiator._id,
      initiatorName: initiator.name,
      friendId: friend._id,
      friendName: friend.name,
      event: event || 'Gündelik',
      effort: effort || 5,
      mood: mood || 'Rahat',
      myOutfit: collabResult.myOutfit,
      friendOutfit: collabResult.friendOutfit,
      compatibilityScore: collabResult.compatibilityScore,
      collabReason: collabResult.collabReason,
      styleHarmony: collabResult.styleHarmony,
      seenByFriend: false,
      createdAt: new Date()
    });
    await session.save();

    console.log(`[Collab] ${initiator.name} + ${friend.name} → ${collabId} (Uyum: %${collabResult.compatibilityScore})`);

    res.json({
      success: true,
      collabId,
      session,
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
      warnings: collabResult.warnings
    });
  } catch (err: any) {
    console.error('[Collab Generate] Hata:', err);
    res.status(err?.status || 500).json({ error: 'Beraber kombin oluşturulamadı.', details: err instanceof Error ? err.message : 'Unknown' });
  }
});

// GET /api/collab/inbox — Gelen collab bildirimleri (arkadaş tarafı)
app.get('/api/collab/inbox', authenticateToken, async (req: any, res) => {
  try {
    const sessions = await CollabSessionModel.find({ friendId: req.user.id } as any)
      .sort({ createdAt: -1 } as any)
      .limit(20);

    const unreadCount = sessions.filter((s: any) => !s.seenByFriend).length;

    res.json({
      success: true,
      sessions: sessions.map((s: any) => ({
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
        createdAt: s.createdAt
      })),
      unreadCount
    });
  } catch (err) {
    console.error('[Collab Inbox] Hata:', err);
    res.status(500).json({ error: 'Collab bildirimleri alınamadı.' });
  }
});

// PATCH /api/collab/:id/seen — Bildirimi "okundu" işaretle
app.patch('/api/collab/:id/seen', authenticateToken, async (req: any, res) => {
  try {
    const session = await CollabSessionModel.findOne({ id: req.params.id } as any);
    if (!session) return res.status(404).json({ error: 'Collab bulunamadı.' });

    // Sadece arkadaş (friendId) okundu işaretleyebilir
    if ((session as any).friendId?.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
    }

    (session as any).seenByFriend = true;
    await session.save();

    res.json({ success: true });
  } catch (err) {
    console.error('[Collab Seen] Hata:', err);
    res.status(500).json({ error: 'Güncelleme başarısız.' });
  }
});

// GET /api/collab/sent — Initiator'ın oluşturduğu collab'lar (gönderilen)
app.get('/api/collab/sent', authenticateToken, async (req: any, res) => {
  try {
    const sessions = await CollabSessionModel.find({ initiatorId: req.user.id } as any)
      .sort({ createdAt: -1 } as any)
      .limit(20);

    res.json({
      success: true,
      sessions: sessions.map((s: any) => ({
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
        createdAt: s.createdAt
      }))
    });
  } catch (err) {
    console.error('[Collab Sent] Hata:', err);
    res.status(500).json({ error: 'Gönderilen collab\'lar alınamadı.' });
  }
});

// ─── Routes ───────────────────────────────────────────────────────────────
app.get('/api/wardrobe', authenticateToken, async (req: any, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const total = await ItemModel.countDocuments({ userId: req.user.id } as any);
    const items = await ItemModel.find({ userId: req.user.id } as any).skip(skip).limit(limit).sort({ _id: -1 } as any);

    res.json({ 
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.post('/api/wardrobe/scan', authenticateToken, async (_req, res) => {
  res.json({ success: true, added: 0, message: 'Tarama artık desteklenmiyor (Bulut tabanlı)' });
});

app.post('/api/wardrobe/enrich', authenticateToken, rateLimit('enrich', RATE_LIMITS.enrich, byUser), async (req: any, res) => {
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
    let failed   = 0;

    for (const item of targets) {
      sendEvent({ type: 'progress', current: enriched + failed + 1, total: targets.length, name: item.name });
      try {
        const downloaded = item.imagePath ? await downloadOwnImage(item.imagePath) : null;
        if (downloaded) {
          const { analysis } = await analyzeClothingImage(downloaded.base64, downloaded.mimeType);
          applyAnalysisToItem(item, analysis);
          item.enrichAttemptedAt = new Date();
          await item.save();
          enriched++;
          sendEvent({ type: 'item_done', id: item.id, name: item.name, category: item.category, color: item.color });
        } else {
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
    console.error('[Enrich] Hata:', err);
    res.status(500).json({ error: 'Zenginleştirme başarısız' });
  }
});

app.post('/api/analyze-image-base64', authenticateToken, rateLimit('analyze', RATE_LIMITS.analyzeImage, byUser), async (req, res) => {
  try {
    const { base64, mimeType } = req.body;
    if (!base64 || !mimeType) return res.status(400).json({ error: 'base64 ve mimeType gerekli' });
    const { analysis, model } = await analyzeClothingImage(base64, mimeType);
    res.json({ success: true, analysis, ...analysis, model });
  } catch (err: any) {
    console.error('[Vision Base64] Hata:', err);
    res.status(err?.status || 500).json({ error: 'Analiz hatası', details: err instanceof Error ? err.message : 'Unknown' });
  }
});

app.get('/api/capsule-analysis', authenticateToken, rateLimit('capsule', RATE_LIMITS.capsuleAnalysis, byUser), async (req: any, res) => {
  try {
    const targetCategory = (req.query.category as any) || 'any';
    const docs = await ItemModel.find({ userId: req.user.id } as any);
    
    if (docs.length < 5) {
      return res.json({
        insufficient: true,
        message: 'Kapsül gardırop simülasyonu yapabilmek için dolabında en az 5 adet kıyafet bulunmalıdır. Lütfen biraz daha kıyafet ekle!'
      });
    }

    const items = docs.map(toEngineItem);
    const result = await analyzeCapsule(items, targetCategory);
    res.json(result);
  } catch (err: any) {
    console.error('[Server] Capsule Analysis Error:', err);
    res.status(500).json({ error: 'Kapsül gardırop analizi oluşturulamadı', details: err instanceof Error ? err.message : 'Unknown' });
  }
});

app.post('/api/generate-outfit', authenticateToken, rateLimit('generate', RATE_LIMITS.generateOutfit, byUser), async (req: any, res) => {
  try {
    const rawRequest = req.body.request || req.body;
    const user = await UserModel.findOne({ _id: req.user.id } as any);
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });

    const result = await generateOutfitsForUser(user, rawRequest, { mode: 'full' });
    res.json(result);
  } catch (err: any) {
    console.error('[Server] Generate Outfit Error:', err);
    const status = err?.status || (err?.message?.includes('gardırobuna') ? 422 : 500);
    res.status(status).json({
      error: err?.message || 'Kombin oluşturulamadı',
      details: err instanceof Error ? err.message : 'Unknown'
    });
  }
});

// ─── Geri Bildirim ve KVKK Uç Noktaları ────────────────────────────────────
app.post('/api/feedback', authenticateToken, async (req: any, res) => {
  try {
    const { type, generationId, itemIds, itemId, reason, note, context } = req.body;
    if (!type) return res.status(400).json({ error: 'type gerekli' });

    const user = await UserModel.findOne({ _id: req.user.id } as any);
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });

    const event = new FeedbackEventModel({
      userId: req.user.id,
      type,
      generationId,
      itemIds,
      itemId,
      reason,
      note,
      context,
      createdAt: new Date()
    });
    await event.save();

    // Kullanıcı bir kombini giydiğini belirttiyse WearLog kaydet ve parçaların giyilme sayısını artır
    if (type === 'worn' && Array.isArray(itemIds) && itemIds.length > 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      const wearLog = new WearLogModel({
        userId: req.user.id,
        date: todayStr,
        itemIds,
        source: 'suggestion',
        createdAt: new Date()
      });
      await wearLog.save();

      await ItemModel.updateMany(
        { id: { $in: itemIds }, userId: req.user.id } as any,
        { $inc: { wearCount: 1 }, $set: { lastWornAt: new Date() } }
      );
    }

    res.json({ success: true, eventId: event._id });
  } catch (err) {
    console.error('[Feedback] Hata:', err);
    res.status(500).json({ error: 'Geri bildirim kaydedilemedi' });
  }
});

app.post('/api/auth/consents', authenticateToken, async (req: any, res) => {
  try {
    const { personalization } = req.body;
    const update: any = {
      'consents.updatedAt': new Date(),
    };
    if (personalization !== undefined) {
      update['consents.personalization'] = {
        granted: Boolean(personalization),
        at: new Date()
      };
    }
    const updatedUser = await UserModel.findOneAndUpdate(
      { _id: req.user.id } as any,
      { $set: update },
      { returnDocument: 'after' } as any
    );
    res.json({ success: true, consents: (updatedUser as any)?.consents });
  } catch (err) {
    console.error('[Consents] Hata:', err);
    res.status(500).json({ error: 'Rıza ayarları kaydedilemedi' });
  }
});

app.post('/api/wardrobe/upload', authenticateToken, rateLimit('upload', RATE_LIMITS.upload, byUser), upload.single('image'), async (req: any, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Dosya eksik' });

    // multer-storage-cloudinary gives us req.file.path (Cloudinary URL)
    // Otomatik format (WebP/AVIF), kalite ve max 1200px genişlik optimizasyonu ekle
    const rawUrl   = file.path as string;
    const imagePath = rawUrl.replace('/upload/', '/upload/f_auto,q_auto,w_1200/');
    const itemData  = JSON.parse(req.body.itemData || '{}');
    const autoAnalyze = req.body.autoAnalyze === 'true' || !itemData.category;

    let analysis: any = null;
    if (autoAnalyze) {
      console.log('[Upload] Gemini Vision analizi başlıyor...');
      analysis = await analyzeImageUrl(imagePath);
    }

    const newItem = new ItemModel({
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId: req.user.id, // Eklendi!
      name:         itemData.name        || analysis?.name        || file.originalname,
      category:     itemData.category    || analysis?.category    || 'top',
      subCategory:  itemData.subCategory || analysis?.subCategory || '',
      color:        itemData.color       || analysis?.color       || '',
      material:     itemData.material    || analysis?.material    || '',
      style:        itemData.style       || analysis?.style       || '',
      pattern:      itemData.pattern     || analysis?.pattern     || '',
      fit:          itemData.fit         || analysis?.fit         || '',
      weatherMatch: itemData.weatherMatch|| analysis?.weatherMatch|| ['sunny', 'cloudy'],
      imagePath,
      attributes:   itemData.attributes  || {},
      aiAnalyzed:   !!analysis
    });

    await newItem.save();
    console.log(`[Upload] ✓ ${newItem.name} (${newItem.category}) eklendi.`);
    res.json({ success: true, item: newItem });
  } catch (err) {
    console.error('[Upload] Hata:', err);
    res.status(500).json({ error: 'Yükleme başarısız', details: err instanceof Error ? err.message : 'Unknown' });
  }
});

app.delete('/api/wardrobe/:id', authenticateToken, async (req: any, res) => {
  try {
    const item = await ItemModel.findOne({ id: req.params.id, userId: req.user.id } as any);
    if (!item) {
      return res.status(404).json({ error: 'Öğe bulunamadı' });
    }

    // Cloudinary'den görseli sil (yalnızca kullanıcının kendi klasöründeyse)
    const publicId = getOwnedPublicId(item.imagePath, req.user.id);
    if (publicId) {
      console.log(`[Cloudinary] Görsel siliniyor: ${publicId}`);
      await cloudinary.uploader.destroy(publicId);
    }

    await ItemModel.deleteOne({ id: req.params.id, userId: req.user.id } as any);
    res.json({ success: true });
  } catch (err) {
    console.error('[Delete] Hata:', err);
    res.status(500).json({ error: 'Silme başarısız' });
  }
});

// ─── Güncelleme Alanı Beyaz Listeleri ──────────────────────────────────────
// İstemciden gelen gövde asla doğrudan veritabanına verilmez. userId, imagePath, id, aiAnalyzed gibi
// alanlar yalnızca sunucu tarafından yazılır; aksi halde kayıt başka kullanıcıya taşınabilir ya da
// imagePath üzerinden başka kullanıcının görseli sildirilebilir.
type UpdatePick = { update: Record<string, unknown> } | { error: string };

function pickStringFields(body: any, fields: Record<string, number>, update: Record<string, unknown>): string | null {
  for (const [field, maxLength] of Object.entries(fields)) {
    const value = body?.[field];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'string' || value.length > maxLength) return `Geçersiz alan: ${field}`;
    update[field] = value;
  }
  return null;
}

function isStringArray(value: unknown, maxItems: number, maxLength: number): value is string[] {
  return Array.isArray(value) && value.length <= maxItems &&
    value.every(v => typeof v === 'string' && v.length <= maxLength);
}

function pickItemUpdate(body: any): UpdatePick {
  const update: Record<string, unknown> = {};
  const error = pickStringFields(body, {
    name: 200, category: 50, subCategory: 100, color: 100, material: 100, style: 50, pattern: 100, fit: 50
  }, update);
  if (error) return { error };

  if (body?.weatherMatch !== undefined && body?.weatherMatch !== null) {
    if (!isStringArray(body.weatherMatch, 10, 30)) return { error: 'Geçersiz alan: weatherMatch' };
    update.weatherMatch = body.weatherMatch;
  }
  return { update };
}

function pickOutfitUpdate(body: any): UpdatePick {
  const update: Record<string, unknown> = {};
  const error = pickStringFields(body, { name: 200, stylingReason: 2000 }, update);
  if (error) return { error };

  if (body?.items !== undefined && body?.items !== null) {
    if (!isStringArray(body.items, 50, 100)) return { error: 'Geçersiz alan: items' };
    update.items = body.items;
  }
  return { update };
}

app.put('/api/wardrobe/:id', authenticateToken, async (req: any, res) => {
  try {
    const picked = pickItemUpdate(req.body);
    if ('error' in picked) return res.status(400).json({ error: picked.error });

    const updated = await ItemModel.findOneAndUpdate(
      { id: req.params.id, userId: req.user.id } as any,
      { $set: picked.update },
      { returnDocument: 'after' } as any
    );
    if (!updated) return res.status(404).json({ error: 'Bulunamadı' });
    res.json({ success: true, item: updated });
  } catch {
    res.status(500).json({ error: 'Güncelleme başarısız' });
  }
});

app.get('/api/outfits', authenticateToken, async (req: any, res) => {
  try {
    const outfits = await OutfitModel.find({ userId: req.user.id } as any).sort({ createdAt: -1 } as any);
    res.json({ outfits });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/outfits', authenticateToken, async (req: any, res) => {
  try {
    const newOutfit = new OutfitModel({
      id: `outfit_${Date.now()}`,
      userId: req.user.id, // Eklendi!
      name: req.body.name || 'Yeni Kombin',
      items: req.body.items || [],
      stylingReason: req.body.stylingReason || '',
      compatibilityScore: req.body.compatibilityScore || 0,
      createdAt: new Date()
    });
    await newOutfit.save();
    res.json({ success: true, outfit: newOutfit });
  } catch {
    res.status(500).json({ error: 'Kombin kaydetme başarısız' });
  }
});

app.delete('/api/outfits/:id', authenticateToken, async (req: any, res) => {
  try {
    await OutfitModel.deleteOne({ id: req.params.id, userId: req.user.id } as any);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Silme başarısız' });
  }
});

app.put('/api/outfits/:id', authenticateToken, async (req: any, res) => {
  try {
    const picked = pickOutfitUpdate(req.body);
    if ('error' in picked) return res.status(400).json({ error: picked.error });

    const updated = await OutfitModel.findOneAndUpdate(
      { id: req.params.id, userId: req.user.id } as any,
      { $set: picked.update },
      { returnDocument: 'after' } as any
    );
    if (!updated) return res.status(404).json({ error: 'Bulunamadı' });
    res.json({ success: true, outfit: updated });
  } catch {
    res.status(500).json({ error: 'Güncelleme başarısız' });
  }
});

// ─── Statik dosyalar & Vite (Sadece Localhost İçin) ───────────────────
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  // ESM formatında dinamik import ile Vite'yi yükle
  import('vite').then(({ createServer }) => {
    createServer({ server: { middlewareMode: true }, appType: 'spa' }).then(vite => {
      app.use(vite.middlewares);
      app.listen(PORT, '0.0.0.0', () => console.log(`[Local] Server running on http://localhost:${PORT}`));
    });
  });
}

// Vercel Serverless Function için dışa aktar
export default app;
