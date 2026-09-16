import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { build } from 'esbuild';

// Vercel, depodaki api/index.js'i çalıştırır. Kaynak değişip paket yeniden üretilmezse canlıya eski kod çıkar.
// Bu test paketin güncel kaynaktan üretildiğini doğrular; başarısız olursa: npm run build
test('api/index.js güncel kaynaktan üretilmiş (npm run build)', async () => {
  const result = await build({
    entryPoints: ['server.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    write: false,
    outfile: 'api/index.js',
    logLevel: 'silent',
  });
  const fresh = result.outputFiles[0].text.replace(/\r\n/g, '\n');
  const committed = fs.readFileSync('api/index.js', 'utf8').replace(/\r\n/g, '\n');
  assert.ok(fresh === committed, 'api/index.js kaynakla uyuşmuyor: "npm run build" çalıştırıp paketi commit et.');
});

test('sunucu paketinde gizli değer yok', () => {
  const bundle = fs.readFileSync('api/index.js', 'utf8');
  assert.ok(!/mongodb(\+srv)?:\/\/[^"'`\s]*:[^"'`\s]*@/.test(bundle), 'bağlantı adresinde şifre');
  assert.ok(!/AIza[0-9A-Za-z_-]{20,}/.test(bundle), 'Gemini anahtarı');
  assert.ok(!bundle.includes('FALLBACK_JWT_SECRET'), 'JWT yedek anahtarı');
});
