// Kaynak kodda veya derlenmiş pakette gömülü gizli değer arar. Base64 ile gizlenmiş dizgeler çözülüp yeniden taranır.

const PATTERNS: [string, RegExp][] = [
  ['şifreli MongoDB adresi', /mongodb(\+srv)?:\/\/[^'"`\s:@/]+:[^'"`\s@]+@/],
  ['Gemini/Google API anahtarı', /AIza[0-9A-Za-z_-]{30,}/],
  ['yayınlanmış JWT yedek anahtarı', /Hnc3Mxz9wO3WfpYRs4LTgme8bZXbsBAck|aura_wardrobe_production_secure_jwt_key/],
];

// Gizli ortam değişkeni eksikse sabit bir dizgeye düşen ifade: process.env.JWT_SECRET ... || 'değer'
const FALLBACK = /process\.env\.(JWT_SECRET|GEMINI_API_KEY|MONGODB_URI|CLOUDINARY_API_KEY|CLOUDINARY_API_SECRET|CLOUDINARY_CLOUD_NAME|VAPID_PRIVATE_KEY|CRON_SECRET)\b[^;\n]{0,40}\|\|\s*(\(?\s*process\.env\.VERCEL\s*\?\s*)?['"`]/;

function scan(text: string): string[] {
  return PATTERNS.filter(([, re]) => re.test(text)).map(([name]) => name);
}

export function findEmbeddedSecrets(source: string): string[] {
  const findings = new Set(scan(source));
  if (FALLBACK.test(source)) findings.add('gizli değişken için sabit yedek değer');
  for (const [, literal] of source.matchAll(/['"`]([A-Za-z0-9+/_-]{16,}={0,2})['"`]/g)) {
    let decoded = '';
    try { decoded = Buffer.from(literal, 'base64').toString('utf8'); } catch { continue; }
    if (!/^[\x20-\x7e]+$/.test(decoded)) continue;
    for (const name of scan(decoded)) findings.add(`base64 içinde ${name}`);
  }
  return Array.from(findings);
}
