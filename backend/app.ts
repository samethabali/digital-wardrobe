import express from 'express';
import type { RequestHandler } from 'express';
import cors from 'cors';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { connectToDatabase } from './db.js';
import { cloudinary } from './cloudinary.js';
import { modelsFor } from './ai/models.js';
import { authRoutes } from './routes/auth.js';
import { socialRoutes } from './routes/social.js';
import { wardrobeRoutes } from './routes/wardrobe.js';
import { personalRoutes } from './routes/personal.js';

export interface AppOptions {
  /** Testlerde Cloudinary yerine sahte yükleme ara katmanı */
  uploadMiddleware?: RequestHandler;
  /** İstek logu (testlerde kapatılır) */
  logRequests?: boolean;
}

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

function cloudinaryUpload(): RequestHandler {
  const storage = new CloudinaryStorage({
    cloudinary,
    params: async (req: any, file) => {
      const userId = req.user?.id || 'public';
      const uniqueId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const cleanPublicId = file.originalname
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_\-.]/g, '')
        .replace(/\.[^/.]+$/, '')
        .slice(0, 60);
      return {
        folder: `digital_wardrobe/${userId}`,
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        public_id: `${cleanPublicId}_${uniqueId}`,
      };
    },
  });
  return multer({ storage, limits: { fileSize: MAX_UPLOAD_BYTES } }).single('image');
}

const ALLOWED_ORIGINS = [
  process.env.APP_URL,
  'https://samethabali.github.io',
  'https://aura-mobile.expo.app',
  'exp://aura-mobile.expo.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8081',
  'exp://localhost:8081',
];

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (origin.endsWith('.vercel.app')) return true;
  // Mobil geliştirme: yerel ağ adresleri (192.168.x.x, 172.x.x.x, 10.x.x.x)
  return /^(http|exp):\/\/(192\.168\.|172\.|10\.)/.test(origin);
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  app.disable('x-powered-by');

  app.use(cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) return callback(null, true);
      console.warn(`[CORS] Engellenen origin: ${origin}`);
      // Hata fırlatmak Express'i 500 ile düşürür; false dönünce tarayıcı isteği kendisi engeller
      callback(null, false);
    },
  }));

  app.use(express.json({ limit: '20mb' })); // Mobil kamera fotoğrafları base64'te ~10-15 MB olabilir

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

  // Serverless: her istekte veritabanı bağlantısını garantile
  app.use(async (_req, res, next) => {
    try {
      await connectToDatabase();
      next();
    } catch (err: any) {
      console.error('[MongoDB Middleware] Bağlantı kurulamadı:', err?.message || err);
      res.status(503).json({ error: 'Veritabanı bağlantısı kurulamadı. Lütfen daha sonra tekrar deneyin.' });
    }
  });

  if (options.logRequests !== false) {
    app.use((req, _res, next) => { console.log(`[Server] ${req.method} ${req.path}`); next(); });
  }

  // Teşhis hattı: yalnızca yerel geliştirmede (kimlik doğrulaması yok)
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.get('/api/debug-models', (_req, res) => {
      res.json({ stylist: modelsFor('stylist'), vision: modelsFor('vision'), light: modelsFor('light') });
    });
  }

  app.use(authRoutes());
  app.use(socialRoutes());
  app.use(wardrobeRoutes({ uploadMiddleware: options.uploadMiddleware || cloudinaryUpload() }));
  app.use(personalRoutes());

  app.use('/api', (_req, res) => { res.status(404).json({ error: 'Uç nokta bulunamadı.' }); });

  // Yakalanmamış hatalar (ör. bozuk JSON gövdesi, dosya boyutu sınırı)
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'İstek gövdesi okunamadı.' });
    if (err?.type === 'entity.too.large' || err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Dosya çok büyük.' });
    console.error('[Server] Beklenmeyen hata:', err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  });

  return app;
}
