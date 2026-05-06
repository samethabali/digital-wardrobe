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

dotenv.config();

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Gemini istemcisi ────────────────────────────────────────
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Hız ve kalite dengesine göre öncelik sırasına dizilmiş güncel modeller
const FALLBACK_MODELS = [
  'gemini-flash-latest',       // 1. Tercih: Terminal testinde 200 OK (Çalışan) model
  'gemini-2.5-flash',          // 2. Tercih: Alternatif yeni sürüm
  'gemini-2.0-flash',          // 3. Tercih: Limit bekleyen sürüm
  'gemini-3-flash-preview'
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
  params: async (req, file) => {
    return {
      folder: 'digital_wardrobe',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      public_id: file.originalname.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_\-.]/g, '')
    };
  },
});
const upload = multer({ storage: storage, limits: { fileSize: 15 * 1024 * 1024 } });

// ─── MongoDB Setup ───────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI || '')
  .then(() => console.log('[MongoDB] Bağlantı başarılı.'))
  .catch(err => console.error('[MongoDB] Bağlantı hatası:', err));

const ItemSchema = new mongoose.Schema({
  id: String,
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
  name: String,
  items: [String],
  stylingReason: String,
  compatibilityScore: Number,
  createdAt: { type: Date, default: Date.now }
});
const OutfitModel = mongoose.models.Outfit || mongoose.model('Outfit', OutfitSchema);

// ─── Gemini Vision: Görsel Analizi ────────────────────────────────────────
async function analyzeImageData(base64: string, mimeType: string) {
  try {
    const response = await executeWithFallback((modelName) => ai.models.generateContent({
      model: modelName,
      contents: [
        {
          parts: [
            { inlineData: { mimeType, data: base64 } },
            {
              text: `Bu bir giysi veya aksesuar fotoğrafı. Lütfen analiz et ve aşağıdaki JSON formatında Türkçe bilgi ver.
Kategori seçenekleri: top (üst giysi), bottom (alt giysi), shoes (ayakkabı), makeup (makyaj), accessory (aksesuar)
Stil seçenekleri: casual, formal, sport, elegant, bohemian
Hava seçenekleri (array): sunny, cloudy, rainy, snowy, hot, cold
Desen seçenekleri (pattern): düz, çizgili, kareli, çiçekli, grafik, noktalı vb.
Kesim seçenekleri (fit): dar, normal, bol, oversize`
            }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name:        { type: Type.STRING, description: 'Türkçe adı (örn: "Lacivert Slim Fit Gömlek")' },
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
    }));
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
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? [process.env.APP_URL, 'https://samethabali.github.io'] 
  : ['http://localhost:3000', 'http://localhost:5173'];

app.use(cors({
  origin: function(origin, callback) {
    // Vercel üzerinden oluşturulan dinamik linklere (.vercel.app) izin ver
    const isVercel = origin && origin.endsWith('.vercel.app');
    
    if (!origin || allowedOrigins.includes(origin) || isVercel) {
      callback(null, true);
    } else {
      console.error(`[CORS] Engellenen origin: ${origin}`);
      callback(new Error('CORS kısıtlaması nedeniyle engellendi.'));
    }
  }
}));

app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => { console.log(`[Server] ${req.method} ${req.url}`); next(); });

// ─── Routes ───────────────────────────────────────────────────────────────
app.get('/api/wardrobe', async (req, res) => {
  try {
    const items = await ItemModel.find();
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.post('/api/wardrobe/scan', async (_req, res) => {
  res.json({ success: true, added: 0, message: 'Tarama artık desteklenmiyor (Bulut tabanlı)' });
});

app.post('/api/wardrobe/enrich', async (req, res) => {
  try {
    const items = await ItemModel.find();

    const isIncomplete = (item: any) =>
      !item.color || !item.style || !item.material || !item.subCategory ||
      item.category === 'top' && !item.subCategory;

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

app.post('/api/analyze-image-base64', async (req, res) => {
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

app.post('/api/generate-outfit', async (req, res) => {
  try {
    const { items, request } = req.body;
    let liveWeatherStr = 'Dikkate alınacak (Önemsiz değil, ancak canlı veri alınamadı)';
    if (!request.ignoreWeather && request.location) {
      const liveWeather = await getWeatherForLocation(request.location);
      if (liveWeather) liveWeatherStr = `CANLI VERİ: ${liveWeather}`;
    }

    const systemInstruction = `Sen profesyonel bir dijital stilist ve moda uzmanısın.
Görevin, kullanıcının gardırobundaki parçaları kullanarak en uygun kombini oluşturmaktır.
KURALLAR:
1. Sadece verilen gardırop listesindeki parçaları kullan (ID'lere göre seç).
2. Kombin zorunlu bileşenleri: 1 Üst (top) + 1 Alt (bottom) + 1 Ayakkabı (shoes).
 Opsiyonel: makeup, accessory.
3. Uyumluluk Puanlaması (0-100):
 - Renk uyumu: Renkler birbiriyle uyumlu mu?
 - Stil uyumu: Parçalar aynı stil ailesinden mi?
 - Etkinlik uyumu: Seçilen etkinliğe uygun mu?
 ${request.ignoreWeather ? '- Hava durumu önemsiz (Kapalı mekan vs.).' : '- Hava durumu CANLI VERİ olarak iletilmiştir, KESİNLİKLE dikkate al.'}
4. stylingReason'ı Türkçe, akıcı ve detaylı yaz.
5. MUTLAKA JSON formatında yanıt ver.
${request.requiredItems?.length ? `6. ZORUNLU: Şu ID'li parçaları KESİNLİKLE kombine dahil etmelisin: ${request.requiredItems.join(', ')}` : ''}
${request.excludedItems?.length ? `7. YASAKLI: Şu ID'li parçaları KESİNLİKLE KULLANMA (seçme): ${request.excludedItems.join(', ')}` : ''}`;

    const userPrompt = `KONUM: ${request.location}\nETKİNLİK: ${request.event}\nEFOR/HAREKET SEVİYESİ: ${request.effort}/10\nRUH HALİ: ${request.mood || 'Belirtilmedi'}\nHAVA DURUMU DURUMU: ${request.ignoreWeather ? 'Önemsiz (Kapalı mekan)' : liveWeatherStr}\n${request.requiredItems?.length ? `ZORUNLU PARÇALAR: ${request.requiredItems.join(', ')}\n` : ''}${request.excludedItems?.length ? `YASAKLI PARÇALAR: ${request.excludedItems.join(', ')}\n` : ''}GARDIROP LİSTESİ (JSON):\n${JSON.stringify(items, null, 2)}`;

    const response = await executeWithFallback((modelName) => ai.models.generateContent({
      model: modelName,
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            selectedItems:     { type: Type.ARRAY, items: { type: Type.STRING } },
            stylingReason:     { type: Type.STRING },
            compatibilityScore:{ type: Type.NUMBER }
          },
          required: ['selectedItems', 'stylingReason', 'compatibilityScore']
        }
      }
    }));

    res.json(JSON.parse(response.text));
  } catch (err: any) {
    console.error('[Server] Generate Outfit Error:', err);
    const is429 = err?.status === 429;
    res.status(is429 ? 429 : 500).json({ error: is429 ? 'Kota sınırı' : 'Kombin oluşturulamadı', details: err instanceof Error ? err.message : 'Unknown' });
  }
});

app.post('/api/wardrobe/upload', upload.single('image'), async (req, res) => {
  try {
    const file = (req as any).file;
    if (!file) return res.status(400).json({ error: 'Dosya eksik' });

    // multer-storage-cloudinary gives us req.file.path which is the Cloudinary URL
    const imagePath = file.path; 
    const itemData  = JSON.parse(req.body.itemData || '{}');
    const autoAnalyze = req.body.autoAnalyze === 'true' || !itemData.category;

    let analysis: any = null;
    if (autoAnalyze) {
      console.log('[Upload] Gemini Vision analizi başlıyor...');
      analysis = await analyzeImageUrl(imagePath);
    }

    const newItem = new ItemModel({
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
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

app.delete('/api/wardrobe/:id', async (req, res) => {
  try {
    await ItemModel.deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Silme başarısız' });
  }
});

app.put('/api/wardrobe/:id', async (req, res) => {
  try {
    // TS hatasını önlemek için query kısmına "as any" ekledik
    const updated = await ItemModel.findOneAndUpdate({ id: req.params.id } as any, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Bulunamadı' });
    res.json({ success: true, item: updated });
  } catch {
    res.status(500).json({ error: 'Güncelleme başarısız' });
  }
});

app.get('/api/outfits', async (req, res) => {
  try {
    const outfits = await OutfitModel.find().sort({ createdAt: -1 });
    res.json({ outfits });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/outfits', async (req, res) => {
  try {
    const newOutfit = new OutfitModel({
      id: `outfit_${Date.now()}`,
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

app.delete('/api/outfits/:id', async (req, res) => {
  try {
    await OutfitModel.deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Silme başarısız' });
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
