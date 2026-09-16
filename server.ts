// .env, diğer modüller (Cloudinary yapılandırması gibi) içe aktarılmadan önce yüklenmeli
import 'dotenv/config';
import { connectToDatabase, setOnFirstConnect } from './backend/db.js';
import { createApp } from './backend/app.js';
import { runMigration } from './backend/migration.js';

const PORT = 3000;

// İlk bağlantıda veritabanı göçünü (migration) arka planda çalıştır
setOnFirstConnect(runMigration);
connectToDatabase().catch(err => console.error('[MongoDB] İlk bağlantı hatası:', err?.message || err));

const app = createApp();

// Statik dosyalar & Vite (yalnızca yerel geliştirme)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  import('vite').then(({ createServer }) => {
    createServer({ server: { middlewareMode: true }, appType: 'spa' }).then(vite => {
      app.use(vite.middlewares);
      app.listen(PORT, '0.0.0.0', () => console.log(`[Local] Server running on http://localhost:${PORT}`));
    });
  });
}

// Vercel Serverless Function için dışa aktar
export default app;
