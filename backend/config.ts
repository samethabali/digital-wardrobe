// Ortam değişkenleri. Gizli değerlerin koddaki yedeği yoktur: eksikse ilgili özellik güvenli biçimde kapanır.
export class ConfigError extends Error {
  constructor(name: string, hint = '') {
    super(`${name} ortam değişkeni tanımlı değil${hint ? ` (${hint})` : ''}.`);
    this.name = 'ConfigError';
  }
}

const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Token imzalama anahtarı. Eksik veya kısaysa hata fırlatır; hiçbir ortamda (Vercel dahil) sabit bir anahtara düşmez.
 * Kodda duran bir anahtar depoyu gören herkesin geçerli token üretebilmesi demektir.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new ConfigError('JWT_SECRET', `en az ${MIN_JWT_SECRET_LENGTH} karakter olmalı`);
  }
  return secret;
}

export function getMongoUri(): string {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new ConfigError('MONGODB_URI');
  return uri;
}

export function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new ConfigError('GEMINI_API_KEY');
  return key;
}

export interface CloudinaryCredentials {
  cloud_name: string;
  api_key: string;
  api_secret: string;
}

export function getCloudinaryCredentials(): CloudinaryCredentials | null {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const api_key = process.env.CLOUDINARY_API_KEY?.trim();
  const api_secret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloud_name || !api_key || !api_secret) return null;
  return { cloud_name, api_key, api_secret };
}

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

/** Web push anahtarları; tanımlı değilse bildirimler kapalıdır. */
export function getVapidConfig(): VapidConfig | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: process.env.VAPID_SUBJECT?.trim() || 'mailto:destek@aura.app' };
}

/** Zamanlanmış görev uç noktasını koruyan anahtar (Vercel Cron "Authorization: Bearer <CRON_SECRET>" gönderir). */
export function getCronSecret(): string | null {
  const secret = process.env.CRON_SECRET?.trim();
  return secret && secret.length >= 16 ? secret : null;
}
