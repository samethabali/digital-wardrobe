import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { GoogleGenAI, Type } from '@google/genai';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getRelevantFashionRules } from './fashionRules.js';

dotenv.config();

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Gemini istemcisi ────────────────────────────────────────
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Hız ve kalite dengesine göre öncelik sırasına dizilmiş güncel modeller
const FALLBACK_MODELS = [
  'models/gemini-2.5-flash',
  'models/gemini-2.0-flash',
  'models/gemini-2.0-flash-lite',   // Hafif ve hızlı alternatif
  'models/gemini-3.1-flash-lite',  // En yeni lite sürüm
  'models/gemini-3-flash-preview', // Yeni nesil önizleme
  'models/gemini-flash-latest',
  'models/gemini-flash-lite-latest',
  'models/gemini-2.5-pro'
];

async function executeWithFallback<T>(fn: (modelName: string) => Promise<T>): Promise<T> {
  let lastError = null;

  for (let i = 0; i < FALLBACK_MODELS.length; i++) {
    const currentModelName = FALLBACK_MODELS[i];
    
    try {
      if (i > 0) console.log(`[AI Motoru] Fallback Deneniyor: ${currentModelName}`);
      return await fn(currentModelName);
    } catch (err: any) {
      lastError = err;
      
      // 429 (Kota), 503 (Sunucu Yoğunluğu), veya 404/400 (Model Bulunamadı/Desteklenmiyor)
      const isRateLimit = err?.status === 429 || err?.status === 503 || err?.message?.includes("429") || err?.message?.includes("quota");
      const isNotFound = err?.status === 404 || err?.status === 400 || err?.message?.includes("not found") || err?.message?.includes("not supported");

      if (isRateLimit || isNotFound) {
        console.warn(`[UYARI] ${currentModelName} atlanıyor (Hata: ${err?.status || 'Bilinmiyor'} - ${isNotFound ? 'Model bulunamadı' : 'Limit/Yoğunluk'}). Bir sonraki modele geçiliyor...`);
        
        if (i === FALLBACK_MODELS.length - 1) {
          console.error("[CRITICAL] Tüm AI modelleri denendi ancak hiçbiri yanıt veremedi!");
          break;
        }
        continue;
      } else {
        // Beklenmeyen mantıksal bir hataysa direkt fırlat
        throw err;
      }
    }
  }

  throw new Error("Yapay zeka asistanı şu an yanıt veremiyor (Modeller ulaşılamaz veya çok yoğun). Lütfen daha sonra tekrar dene.");
}

// ─── Cloudinary Config ───────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

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

// ─── MongoDB Setup ───────────────────────────────────────────
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  username: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true },
  isPrivate: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
const UserModel = mongoose.models.User || mongoose.model('User', UserSchema);

const ItemSchema = new mongoose.Schema({
  id: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  name: String,
  category: String,
  subCategory: String,
  color: String,
  material: String,
  style: String,
  pattern: String,
  fit: String,
  weatherMatch: [String],
  imagePath: String,
  attributes: mongoose.Schema.Types.Mixed,
  aiAnalyzed: Boolean
});
const ItemModel = mongoose.models.Item || mongoose.model('Item', ItemSchema);

const OutfitSchema = new mongoose.Schema({
  id: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  name: String,
  items: [String],
  stylingReason: String,
  compatibilityScore: Number,
  createdAt: { type: Date, default: Date.now }
});
const OutfitModel = mongoose.models.Outfit || mongoose.model('Outfit', OutfitSchema);

const CollabSessionSchema = new mongoose.Schema({
  id: { type: String, unique: true, index: true },
  initiatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  initiatorName: String,
  friendId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  friendName: String,
  event: String,
  effort: Number,
  mood: String,
  myOutfit: [String],
  friendOutfit: [String],
  compatibilityScore: Number,
  collabReason: String,
  styleHarmony: String,
  seenByFriend: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
const CollabSessionModel = mongoose.models.CollabSession || mongoose.model('CollabSession', CollabSessionSchema);

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'aura_secret_key_123_change_me';

// Veri Göçü (Migration) Scripti
async function runMigration() {
  try {
    const adminEmail = 'samet@aura.com';
    let admin = await UserModel.findOne({ email: adminEmail } as any);
    if (!admin) {
      console.log('[Migration] samet@aura.com kullanıcısı oluşturuluyor...');
      const passwordHash = await bcrypt.hash('Aura123!', 10);
      admin = new UserModel({
        email: adminEmail,
        username: 'samet',
        passwordHash,
        name: 'Samet',
        createdAt: new Date()
      });
      await admin.save();
      console.log('[Migration] samet@aura.com başarıyla oluşturuldu.');
    } else if (!(admin as any).username) {
      (admin as any).username = 'samet';
      await admin.save();
      console.log('[Migration] samet@aura.com kullanıcısına default kullanıcı adı (samet) tanımlandı.');
    }

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

    // userId'si olmayan gardırop öğelerini güncelle
    const itemsWithoutUser = await ItemModel.find({ userId: { $exists: false } } as any);
    if (itemsWithoutUser.length > 0) {
      console.log(`[Migration] ${itemsWithoutUser.length} adet sahipsiz gardırop öğesi admin kullanıcısına bağlanıyor...`);
      await ItemModel.updateMany({ userId: { $exists: false } } as any, { $set: { userId: admin._id } });
      console.log('[Migration] Gardırop öğeleri başarıyla güncellendi.');
    }

    // userId'si olmayan kombinleri güncelle
    const outfitsWithoutUser = await OutfitModel.find({ userId: { $exists: false } } as any);
    if (outfitsWithoutUser.length > 0) {
      console.log(`[Migration] ${outfitsWithoutUser.length} adet sahipsiz kombin admin kullanıcısına bağlanıyor...`);
      await OutfitModel.updateMany({ userId: { $exists: false } } as any, { $set: { userId: admin._id } });
      console.log('[Migration] Kombinler başarıyla güncellendi.');
    }
  } catch (err) {
    console.error('[Migration] Hata oluştu:', err);
  }
}

let cachedConnection: typeof mongoose | null = null;

async function connectToDatabase() {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  const uri = process.env.MONGODB_URI || '';
  if (!uri) {
    throw new Error('MONGODB_URI tanımlı değil.');
  }

  // Serverless için bağlantıyı önbelleğe al
  cachedConnection = await mongoose.connect(uri);
  console.log('[MongoDB] Yeni bağlantı başarıyla kuruldu.');
  
  // İlk bağlantıda veritabanı göçünü (migration) arka planda asenkron çalıştır
  runMigration();
  
  return cachedConnection;
}

// Sunucu ilk başladığında asenkron olarak bağlantıyı tetikle (Localhost hızlandırması için)
connectToDatabase().catch(err => console.error('[MongoDB] İlk bağlantı hatası:', err));


// ─── Gemini Vision: Görsel Analizi ────────────────────────────────────────
async function analyzeImageData(base64: string, mimeType: string) {
  try {
    const response = await executeWithFallback(async (modelName) => {
      return await ai.models.generateContent({
        model: modelName,
        contents: [
          { inlineData: { mimeType, data: base64 } },
          {
            text: `Bu bir giysi veya aksesuar fotoğrafı. Lütfen analiz et ve aşağıdaki JSON formatında Türkçe bilgi ver.
Kategori seçenekleri: top (üst giysi), bottom (alt giysi), outerwear (dış giyim/kaban/ceket), shoes (ayakkabı), makeup (makyaj), accessory (aksesuar)
Stil seçenekleri: casual, formal, sport, elegant, bohemian
Hava seçenekleri (array): sunny, cloudy, rainy, snowy, hot, cold
Desen seçenekleri (pattern): düz, çizgili, kareli, çiçekli, grafik, noktalı vb.
Kesim seçenekleri (fit): dar, normal, bol, oversize`
          }
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name:        { type: Type.STRING },
              category:    { type: Type.STRING },
              subCategory: { type: Type.STRING },
              color:       { type: Type.STRING },
              material:    { type: Type.STRING },
              style:       { type: Type.STRING },
              pattern:     { type: Type.STRING },
              fit:         { type: Type.STRING },
              weatherMatch:{ type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['name', 'category', 'subCategory', 'color', 'style', 'weatherMatch']
          }
        }
      });
    });

    return JSON.parse(response.text);
  } catch (err) {
    console.error('[Vision] Analiz hatası:', err);
    return null;
  }
}

async function analyzeImageUrl(url: string) {
  try {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mimeType = response.headers.get('content-type') || 'image/jpeg';
    return analyzeImageData(base64, mimeType);
  } catch(e) {
    console.error('[Vision] Fotoğraf indirilirken hata:', e);
    return null;
  }
}

// ─── Weather API (Open-Meteo) ─────────────────────────────────────────────
async function getWeatherForLocation(location: string): Promise<string | null> {
  try {
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=tr&format=json`);
    const geoData = await geoRes.json();
    if (!geoData.results || geoData.results.length === 0) return null;
    const { latitude, longitude, name, country } = geoData.results[0];
    const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
    const weatherData = await weatherRes.json();
    if (weatherData.current_weather) {
      const { temperature, windspeed, weathercode } = weatherData.current_weather;
      const weatherMap: Record<number, string> = {
        0: 'Açık, Güneşli', 1: 'Çoğunlukla Açık', 2: 'Parçalı Bulutlu', 3: 'Kapalı/Bulutlu',
        45: 'Sisli', 48: 'Kırağılı Sis', 51: 'Hafif Çisenti', 53: 'Orta Çisenti', 55: 'Yoğun Çisenti',
        61: 'Hafif Yağmurlu', 63: 'Orta Şiddetli Yağmurlu', 65: 'Şiddetli Yağmurlu',
        71: 'Hafif Kar Yağışlı', 73: 'Orta Şiddetli Kar Yağışlı', 75: 'Yoğun Kar Yağışlı',
        95: 'Gök Gürültülü Fırtına', 96: 'Hafif Dolu ile Fırtına', 99: 'Şiddetli Dolu ile Fırtına'
      };
      const desc = weatherMap[weathercode] || 'Bilinmiyor';
      return `${name}, ${country}: ${temperature}°C, ${desc}`;
    }
  } catch (error) {
    console.error('[Weather API] Hata:', error);
  }
  return null;
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

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Geçersiz veya süresi dolmuş token.' });
    }
    req.user = user;
    next();
  });
}

// Cloudinary public_id helper
function getPublicIdFromUrl(url: string): string | null {
  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    
    let publicIdWithExtension = parts[1];
    if (publicIdWithExtension.startsWith('v')) {
      const slashIndex = publicIdWithExtension.indexOf('/');
      if (slashIndex !== -1) {
        publicIdWithExtension = publicIdWithExtension.substring(slashIndex + 1);
      }
    }
    
    if (publicIdWithExtension.includes('digital_wardrobe/')) {
      const idx = publicIdWithExtension.indexOf('digital_wardrobe/');
      publicIdWithExtension = publicIdWithExtension.substring(idx);
    }

    const dotIndex = publicIdWithExtension.lastIndexOf('.');
    if (dotIndex !== -1) {
      return publicIdWithExtension.substring(0, dotIndex);
    }
    return publicIdWithExtension;
  } catch (e) {
    console.error('[Cloudinary] Extract public_id error:', e);
    return null;
  }
}

// ─── Teşhis Hattı ───────────────────────────────────────────
app.get('/api/debug-models', async (req, res) => {
  try {
    const models = await ai.models.list();
    res.json({ models });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AUTH ENDPOINTS ──────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
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

app.post('/api/auth/login', async (req, res) => {
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
      .map(item => getPublicIdFromUrl(item.imagePath))
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

    // 3) MongoDB'den kıyafetleri ve kombinleri sil
    await ItemModel.deleteMany({ userId } as any);
    await OutfitModel.deleteMany({ userId } as any);

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
app.post('/api/collab/generate', authenticateToken, async (req: any, res) => {
  try {
    const { friendUserId, event, effort, mood, ignoreWeather, location } = req.body;
    if (!friendUserId) return res.status(400).json({ error: 'Arkadaş ID\'si gereklidir.' });

    // Arkadaşın profilini kontrol et
    const friendUser = await UserModel.findOne({ _id: friendUserId } as any);
    if (!friendUser) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    if ((friendUser as any).isPrivate) {
      return res.status(403).json({ error: 'Bu kullanıcının profili gizlidir.' });
    }

    // Kendi gardırobunu çek
    const myItems = await ItemModel.find({ userId: req.user.id } as any);
    if (myItems.length < 3) {
      return res.status(400).json({ error: 'Beraber kombin için en az 3 kıyafete ihtiyaç var. Lütfen gardırobuna parça ekle.' });
    }

    // Arkadaşın gardırobunu çek
    const friendItems = await ItemModel.find({ userId: friendUserId } as any);
    if (friendItems.length < 3) {
      return res.status(400).json({ error: 'Arkadaşının gardırobunda yeterli kıyafet yok (en az 3 gerekli).' });
    }

    // Hava durumu (opsiyonel)
    let liveWeatherStr = 'Dikkate alınacak (canlı veri alınamadı)';
    if (!ignoreWeather && location) {
      const liveWeather = await getWeatherForLocation(location);
      if (liveWeather) liveWeatherStr = `CANLI VERİ: ${liveWeather}`;
    }

    // Veri temizliği
    const sanitize = (items: any[], owner: 'me' | 'friend') =>
      items.map((i: any) => ({
        owner,
        id: i.id,
        category: i.category,
        subCategory: i.subCategory,
        color: i.color,
        material: i.material,
        style: i.style,
        pattern: i.pattern,
        fit: i.fit,
        weatherMatch: i.weatherMatch
      }));

    const allItems = [
      ...sanitize(myItems, 'me'),
      ...sanitize(friendItems, 'friend')
    ].sort(() => Math.random() - 0.5);

    const systemInstruction = `Sen elit bir moda stilisti ve çift stil danışmanısın. İki farklı kişinin gardırop parçalarından, birbirleriyle beraber çıkacakları bir etkinlik için AYRI AYRI uyumlu kombinler oluşturmak senin görevin.

KURALLAR:
1. Her gardırop listesinde 'owner' alanı 'me' olanlar birinci kişiye, 'friend' olanlar ikinci kişiye aittir.
2. 'myOutfit' dizisi: SADECE owner='me' olan parçaların ID'lerini içerir.
3. 'friendOutfit' dizisi: SADECE owner='friend' olan parçaların ID'lerini içerir.
4. Her iki kombin de kendi içinde eksiksiz olmalı (üst + alt + ayakkabı minimum).
5. İKİ KOMBİN BİRBİRİYLE RENK VE STİL AÇISINDAN UYUMLU OLMALI. Bu en kritik kuraldır.
6. 'styleHarmony': İki kombini bir araya getiren stil/renk prensibini kısa ve etkileyici bir cümleyle özetle (Örn: 'Monokromatik Siyah Sinerji', 'Tonal Bej Uyumu', 'Bold Renk Bloklaması').
7. 'collabReason': Her iki kombinin neden uyumlu göründüğünü, kullandığın renk teorisini ve stil prensiplerini profesyonel, ilham verici Türkçe ile açıkla (3-4 cümle).
8. 'compatibilityScore': İki kombinin birbirleriyle uyumunu 100 üzerinden tam sayı olarak puan ver.
9. MUTLAKA belirtilen JSON şemasında yanıt ver.`;

    const userPrompt = `ETKİNLİK: ${event || 'Gündelik'}
EFOR SEVİYESİ: ${effort || 5}/10
RUH HALİ: ${mood || 'Rahat'}
HAVA DURUMU: ${ignoreWeather ? 'Önemsiz (Kapalı mekan)' : liveWeatherStr}

BİRİNCİ KİŞİ (me): ${req.user.name}
İKİNCİ KİŞİ (friend): ${(friendUser as any).name}

TÜM PARÇALAR (owner alanına dikkat et):
${JSON.stringify(allItems)}`;

    const response = await executeWithFallback(async (modelName) => {
      return await ai.models.generateContent({
        model: modelName,
        contents: userPrompt,
        config: {
          systemInstruction,
          temperature: 0.8,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              myOutfit:           { type: Type.ARRAY, items: { type: Type.STRING } },
              friendOutfit:       { type: Type.ARRAY, items: { type: Type.STRING } },
              compatibilityScore: { type: Type.INTEGER },
              collabReason:       { type: Type.STRING },
              styleHarmony:       { type: Type.STRING }
            },
            required: ['myOutfit', 'friendOutfit', 'compatibilityScore', 'collabReason', 'styleHarmony']
          }
        }
      });
    });

    const aiResult = JSON.parse(response.text);

    // MongoDB'ye kaydet
    const collabId = `collab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const session = new CollabSessionModel({
      id: collabId,
      initiatorId: req.user.id,
      initiatorName: req.user.name,
      friendId: friendUserId,
      friendName: (friendUser as any).name,
      event: event || 'Gündelik',
      effort: effort || 5,
      mood: mood || 'Rahat',
      myOutfit: aiResult.myOutfit,
      friendOutfit: aiResult.friendOutfit,
      compatibilityScore: aiResult.compatibilityScore,
      collabReason: aiResult.collabReason,
      styleHarmony: aiResult.styleHarmony,
      seenByFriend: false,
      createdAt: new Date()
    });
    await session.save();

    console.log(`[Collab] ${req.user.name} + ${(friendUser as any).name} → ${collabId} (Uyum: %${aiResult.compatibilityScore})`);

    res.json({
      success: true,
      collabId,
      myOutfit: aiResult.myOutfit,
      friendOutfit: aiResult.friendOutfit,
      compatibilityScore: aiResult.compatibilityScore,
      collabReason: aiResult.collabReason,
      styleHarmony: aiResult.styleHarmony,
      friendName: (friendUser as any).name,
      initiatorName: req.user.name
    });
  } catch (err: any) {
    console.error('[Collab Generate] Hata:', err);
    res.status(500).json({ error: 'Beraber kombin oluşturulamadı.', details: err instanceof Error ? err.message : 'Unknown' });
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

app.post('/api/wardrobe/enrich', authenticateToken, async (req: any, res) => {
  try {
    const items = await ItemModel.find({ userId: req.user.id } as any);

    // Üst/alt/dış giyimde desen ve kesim de eksik sayılır
    const isIncomplete = (item: any) => {
      const needsFitPattern = ['top', 'bottom', 'outerwear'].includes(item.category);
      return !item.color || !item.style || !item.material || !item.subCategory ||
        (needsFitPattern && (!item.pattern || !item.fit));
    };

    const targets = items.filter(isIncomplete);

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
        const analysis = await analyzeImageUrl(item.imagePath!);
        if (analysis) {
          item.name = item.name || analysis.name;
          item.category = item.category === 'top' ? analysis.category : item.category;
          item.subCategory = item.subCategory || analysis.subCategory;
          item.color = item.color || analysis.color;
          item.material = item.material || analysis.material || '';
          item.style = item.style || analysis.style;
          item.pattern = item.pattern || analysis.pattern || '';
          item.fit = item.fit || analysis.fit || '';
          if (!item.weatherMatch?.length || (item.weatherMatch.length === 2 && item.weatherMatch[0] === 'sunny')) {
            item.weatherMatch = analysis.weatherMatch;
          }
          item.aiAnalyzed = true;
          await item.save();
          enriched++;
          sendEvent({ type: 'item_done', id: item.id, name: item.name, category: item.category, color: item.color });
        } else { failed++; }
      } catch { failed++; }
      await new Promise(r => setTimeout(r, 1500));
    }
    sendEvent({ type: 'done', enriched, failed, message: `${enriched} öğe tamamlandı, ${failed} başarısız.` });
    res.end();
  } catch (err) {
    console.error('[Enrich] Hata:', err);
    res.status(500).json({ error: 'Zenginleştirme başarısız' });
  }
});

app.post('/api/analyze-image-base64', authenticateToken, async (req, res) => {
  try {
    const { base64, mimeType } = req.body;
    if (!base64 || !mimeType) return res.status(400).json({ error: 'base64 ve mimeType gerekli' });
    const analysis = await analyzeImageData(base64, mimeType);
    if (!analysis) return res.status(500).json({ error: 'Analiz başarısız' });
    res.json({ success: true, analysis });
  } catch (err) {
    res.status(500).json({ error: 'Analiz hatası' });
  }
});

app.get('/api/capsule-analysis', authenticateToken, async (req: any, res) => {
  try {
    const targetCategory = req.query.category as string || 'any';
    const items = await ItemModel.find({ userId: req.user.id } as any);
    
    if (items.length < 5) {
      return res.json({
        insufficient: true,
        message: 'Kapsül gardırop simülasyonu yapabilmek için dolabında en az 5 adet kıyafet bulunmalıdır. Lütfen biraz daha kıyafet ekle!'
      });
    }

    const sanitizedItems = items.map((i: any) => ({
      id: i.id,
      category: i.category,
      subCategory: i.subCategory,
      color: i.color,
      material: i.material,
      style: i.style,
      pattern: i.pattern,
      fit: i.fit
    }));

    let categoryRestrictionInstruction = '';
    if (targetCategory && targetCategory !== 'any') {
      const categoryLabelsTR: Record<string, string> = {
        top: 'Üst Giyim (top)',
        bottom: 'Alt Giyim (bottom)',
        outerwear: 'Dış Giyim (outerwear)',
        shoes: 'Ayakkabı (shoes)',
        accessory: 'Aksesuar (accessory)'
      };
      const labelTR = categoryLabelsTR[targetCategory] || targetCategory;
      categoryRestrictionInstruction = `\nKESİNLİKLE UYULMASI GEREKEN KATEGORİ KISITI: Önerdiğin 'kilit eksik parça' (Suggested Item) KESİNLİKLE '${targetCategory}' (${labelTR}) kategorisinde olmak zorundadır. Başka hiçbir kategoriden kıyafet veya aksesuar öneremezsin. Kombin artış simülasyonunu da sadece bu kategoriye özel bir parçanın dolaba eklenmesi durumuna göre hesapla.`;
    }

    const systemInstruction = `Sen elit bir kapsül gardırop uzmanı, moda analisti ve kişisel stil danışmanısın.
Görevin, kullanıcının gardırobundaki parçaları inceleyerek, dolabın potansiyelini katlayacak tek bir eksik anahtar parçayı (anchor item) bulmak ve bunun simülasyonunu yapmaktır.
${categoryRestrictionInstruction}

ANALİZ ADIMLARI:
1. Gardırop listesini incele: Renk dağılımı nasıl (örn. çok fazla siyah mı var)? Hangi kategoride (üst, alt, ayakkabı, dış giyim) eksiklik veya dengesizlik var?
2. Mevcut gardıroptaki parçalarla teorik olarak oluşturulabilecek maksimum uyumlu kombin sayısını tahmin et (Örn: 12).
3. Dolaba eklendiğinde **kombinasyon potansiyelini maksimuma çıkaracak** tam 1 adet 'kilit eksik parça' (Suggested Item) belirle (Örn: "Bej Blazer Ceket", "Siyah Trençkot", "Beyaz Deri Sneaker"). Bu parça mevcut parçalarla en çok renk ve stil uyumu yakalayacak çok yönlü bir parça olmalıdır. (Kategori kısıtına KESİNLİKLE uymalısın!)
4. Bu kilit parça eklendikten sonra oluşacak yeni toplam kombin potansiyelini hesapla (Örn: 34). Bu sayı mevcut sayının en az 2 katı civarında ve gerçekçi olmalıdır.
5. Bu parçanın neden seçildiğini, dolaptaki hangi parçaları canlandıracağını ve nasıl kombinleneceğini profesyonel, motive edici ve elit bir Türkçe ile açıkla (3-4 cümle).
6. MUTLAKA belirtilen JSON şemasında yanıt ver. Sayısal alanlar KESİNLİKLE tam sayı (INTEGER) olmalıdır.`;

    const userPrompt = `KONUM / HEDEF KATEGORİ: ${targetCategory}
GARDIROP LİSTESİ (JSON):
${JSON.stringify(sanitizedItems)}`;

    const response = await executeWithFallback(async (modelName) => {
      return await ai.models.generateContent({
        model: modelName,
        contents: userPrompt,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              currentOutfitCount:  { type: Type.INTEGER },
              projectedOutfitCount: { type: Type.INTEGER },
              suggestedItem: {
                type: Type.OBJECT,
                properties: {
                  name:     { type: Type.STRING },
                  category: { type: Type.STRING },
                  reason:   { type: Type.STRING }
                },
                required: ['name', 'category', 'reason']
              }
            },
            required: ['currentOutfitCount', 'projectedOutfitCount', 'suggestedItem']
          }
        }
      });
    });

    res.json(JSON.parse(response.text));
  } catch (err: any) {
    console.error('[Server] Capsule Analysis Error:', err);
    res.status(500).json({ error: 'Kapsül gardırop analizi oluşturulamadı', details: err instanceof Error ? err.message : 'Unknown' });
  }
});

app.post('/api/generate-outfit', authenticateToken, async (req: any, res) => {
  try {
    const { request } = req.body;
    
    // Yüksek Performans: İstemciden büyük gardırop dizisini göndermek yerine doğrudan MongoDB'den tümünü çekiyoruz.
    // Bu sayede AI, kullanıcının gardırobundaki tüm parçalara (sayfalama sınırına takılmadan) erişebilir.
    const items = await ItemModel.find({ userId: req.user.id } as any);
    
    // Veri temizliği (Payload Sanitization) - Gereksiz özellikleri (imagePath, db meta vs) çıkararak token tasarrufu sağlarız
    const sanitizedItems = items.map((i: any) => ({
      id: i.id,
      category: i.category,
      subCategory: i.subCategory,
      color: i.color,
      material: i.material,
      style: i.style,
      pattern: i.pattern,
      fit: i.fit,
      weatherMatch: i.weatherMatch
    }));

    // Çözüm A: Sıralama eğilimini (Primacy Bias) kırmak için gardırop listesini rastgele karıştırıyoruz
    const shuffledItems = [...sanitizedItems].sort(() => Math.random() - 0.5);

    let liveWeatherStr = 'Dikkate alınacak (Önemsiz değil, ancak canlı veri alınamadı)';
    if (!request.ignoreWeather && request.location) {
      const liveWeather = await getWeatherForLocation(request.location);
      if (liveWeather) liveWeatherStr = `CANLI VERİ: ${liveWeather}`;
    }

    // ─── RAG Moda Bilgi Bankasından Kuralları Çekme ────────────────────────────
    const matchedRules = getRelevantFashionRules(request, liveWeatherStr);
    const fashionRulesString = matchedRules.map((rule, idx) => `${idx + 1}. ${rule}`).join('\n');

    // ─── Tekrarlamayı Kırmak İçin Yaratıcı Açı (Creative Seed) Seçimi ─────────
    const creativeAngles = [
      "doku kontrastlarını ön plana çıkarmak (örn. deri ceket ile pürüzsüz saten veya yün triko ile keten eşleşmesi)",
      "cesur ama dengeli renk kontrastları (renk bloklama - color blocking) oluşturmak",
      "minimalist, çabasız ve son derece prestijli bir şıklık yakalamak",
      "monokromatik veya ton-sür-ton geçişlerle göz alıcı bir dikey derinlik sunmak",
      "ayakkabılar veya aksesuarlar aracılığıyla patlayıcı ve zengin bir vurgu (accent color) rengi eklemek",
      "vücut proporsiyonunu 1/3 üst, 2/3 alt giyim şeklinde göstererek bacak boyunu uzatmak",
      "klasik çizgilerin sportif ve konforlu dokunuşlarla dinamik harmanını (Smart Casual) yansıtmak"
    ];
    const selectedAngle = creativeAngles[Math.floor(Math.random() * creativeAngles.length)];

    const systemInstruction = `Sen elit bir moda tasarımcısı, haute couture stilist ve kişisel stil danışmanısın.
Görevin, kullanıcının gardırobundaki parçaları kullanarak, verilen etkinlik, hava durumu ve stil bağlamına en uygun, estetik olarak kusursuz bir kombin oluşturmaktır.

KURALLAR:
1. Yalnızca verilen GARDIROP LİSTESİ'ndeki parçaları (ID'lerine göre) kullanabilirsin. Asla listede olmayan bir eşya uydurma.
2. KATMANLAMA VE KATEGORİ MANTIĞI:
   - Standart bir kombin KESİNLİKLE 1 Üst (top) + 1 Alt (bottom) + 1 Ayakkabı (shoes) gerektirir. Üst (top) veya Alt (bottom) parçalarından birini eksik bırakmak KESİNLİKLE yasaktır.
   - ÖZEL DURUM 1 (Elbise/Tulum): Eğer seçtiğin parça tek parça bir giysi (category = 'top' veya 'bottom' olup subCategory 'elbise', 'tulum' vb. ise), bu parça hem üst hem alt yerine geçer. Bu durumda kombine fazladan bir "bottom" veya "top" EKLEME.
   - ÖZEL DURUM 2 (Dış Giyim / Outerwear): Canlı hava durumu soğuk, rüzgarlı veya yağmurluysa, veya stil katmanlama gerektiriyorsa KESİNLİKLE uygun bir "outerwear" (dış giyim, kaban, mont, ceket, hırka) ekle.
   - Kombine opsiyonel olarak uygun "accessory" ve "makeup" parçaları ekleyebilirsin.
3. HAVA DURUMU UYUMU:
   - Canlı hava durumunu KESİNLİKLE dikkate al. Parçaların "weatherMatch" etiketleriyle hava koşullarını eşleştir.
4. KİLİTLİ/ZORUNLU PARÇALAR (Required Items) VE DİNAMİK YENİLEME MANTIĞI:
   - Eğer kullanıcı zorunlu parçalar seçmişse (requiredItems), bunları kombine KESİNLİKLE DAHİL ET.
   - ÖNEMLİ TEKRAR ENGELİ: Eğer bazı parçalar kilitliyse (requiredItems), bu parçaları koru ancak kilitlenmeyen DİĞER parçaları KESİNLİKLE değiştirerek tamamen yeni ve farklı bir kombinasyona dönüştür. Kilitli parça dışındaki parçaların eski kombinle tamamen aynı kalması KESİNLİKLE kabul edilemez.
5. YAKIN ZAMANDA ÖNERİLEN KOMBİNLERİN ENGELLENMESİ:
   - 'YAKIN ZAMANDA ÖNERİLEN KOMBİNLER' başlığı altında listelenen ID gruplarının birebir aynısını KESİNLİKLE tekrar önerme. O ID setlerinin birebir aynısını seçmek KESİNLİKLE yasaktır. En az bir veya birkaç parçayı değiştirerek farklı ve yepyeni kombinasyonlar üret.
6. AÇIKLAMA KALİTESİ VE ANALİZ (stylingReason):
   - Neden bu parçaları seçtiğini, kullanıcının kişisel stil kimliğine ve hava durumuna nasıl uyduğunu açıkla. Açıklamanda KESİNLİKLE uyguladığın renk teorisini (örn. 60-30-10 kuralı, kontrast veya monokrom) ve silüet dengesini (örn. dar-bol kontrastı, tucked-in bacak boyu) profesyonel, ilham verici ve elit bir Türkçe ile açıkla (3-4 cümle).
7. UYUMLULUK PUANI (compatibilityScore):
   - 100 üzerinden bir TAM SAYI (INTEGER) olmalıdır (Örn: 85, 92, 98). Kesinlikle 1-10 arası ondalıklı puan (Örn: 9.5 veya 10.0) dönme, doğrudan 100 üzerinden yüzde oranı temsil eden bir tam sayı dön.
8. DİNAMİK STİL ODAĞI: Kombini yaparken şu yaratıcı odağı / tasarımı özellikle temel al: "${selectedAngle}".
9. MUTLAKA belirtilen JSON şemasında yanıt ver.`;

    // Son kombinleri listeleme
    let recentOutfitsStr = 'Yok';
    if (request.recentOutfits && request.recentOutfits.length > 0) {
      recentOutfitsStr = request.recentOutfits.map((ids: string[], idx: number) => `Kombin ${idx + 1}: [${ids.join(', ')}]`).join('\n');
    }

    const userPrompt = `KONUM: ${request.location}
ETKİNLİK: ${request.event}
EFOR/HAREKET SEVİYESİ: ${request.effort}/10
RUH HALİ: ${request.mood || 'Belirtilmedi'}
KİŞİSEL BAĞLAM/STİL KİMLİĞİ: ${request.personalContext || 'Belirtilmedi'}
ÖZEL STİL TERCİHLERİ: ${request.styleTags?.join(', ') || 'Belirtilmedi'}
HAVA DURUMU: ${request.ignoreWeather ? 'Önemsiz (Kapalı mekan)' : liveWeatherStr}
${request.requiredItems?.length ? `ZORUNLU PARÇALAR (Kesinlikle Kullan): ${request.requiredItems.join(', ')}\n` : ''}${request.excludedItems?.length ? `YASAKLI PARÇALAR (Kesinlikle Kullanma): ${request.excludedItems.join(', ')}\n` : ''}
YAKIN ZAMANDA ÖNERİLEN VE TEKRARLANMAMASI GEREKEN KOMBİNLER:
${recentOutfitsStr}

DİNAMİK MODA VE RENK KURALLARI (RAG):
${fashionRulesString}

GARDIROP LİSTESİ (JSON):
${JSON.stringify(shuffledItems)}`;

    const response = await executeWithFallback(async (modelName) => {
      return await ai.models.generateContent({
        model: modelName,
        contents: userPrompt,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.85, // Yenilik ve yaratıcılık için sıcaklığı biraz daha artırdık
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              selectedItems:     { type: Type.ARRAY, items: { type: Type.STRING } },
              stylingReason:     { type: Type.STRING },
              compatibilityScore:{ type: Type.INTEGER } // Kesinlikle INTEGER olarak zorladık
            },
            required: ['selectedItems', 'stylingReason', 'compatibilityScore']
          }
        }
      });
    });

    res.json(JSON.parse(response.text));
  } catch (err: any) {
    console.error('[Server] Generate Outfit Error:', err);
    const is429 = err?.status === 429;
    res.status(is429 ? 429 : 500).json({ error: is429 ? 'Kota sınırı' : 'Kombin oluşturulamadı', details: err instanceof Error ? err.message : 'Unknown' });
  }
});

app.post('/api/wardrobe/upload', authenticateToken, upload.single('image'), async (req: any, res) => {
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

    // Cloudinary'den görseli sil
    if (item.imagePath) {
      const publicId = getPublicIdFromUrl(item.imagePath);
      if (publicId) {
        console.log(`[Cloudinary] Görsel siliniyor: ${publicId}`);
        await cloudinary.uploader.destroy(publicId);
      }
    }

    await ItemModel.deleteOne({ id: req.params.id, userId: req.user.id } as any);
    res.json({ success: true });
  } catch (err) {
    console.error('[Delete] Hata:', err);
    res.status(500).json({ error: 'Silme başarısız' });
  }
});

app.put('/api/wardrobe/:id', authenticateToken, async (req: any, res) => {
  try {
    const updated = await ItemModel.findOneAndUpdate(
      { id: req.params.id, userId: req.user.id } as any,
      req.body,
      { new: true } as any
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
    const updated = await OutfitModel.findOneAndUpdate(
      { id: req.params.id, userId: req.user.id } as any,
      req.body,
      { new: true } as any
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
