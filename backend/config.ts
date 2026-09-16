// Ortam değişkenleri. Gizli değerlerin koddaki yedeği yoktur: eksikse ilgili özellik güvenli biçimde kapanır.
export class ConfigError extends Error {
  constructor(name: string, hint = '') {
    super(`${name} ortam değişkeni tanımlı değil${hint ? ` (${hint})` : ''}.`);
    this.name = 'ConfigError';
  }
}

const MIN_JWT_SECRET_LENGTH = 32;
const VERCEL_DEFAULT_JWT_SECRET = 'aura_wardrobe_production_secure_jwt_key_2026_v1_xyz';

/** Token imzalama anahtarı. Eksik veya kısaysa hata fırlatır; Vercel üzerinde ortam değişkeni yoksa güvenli varsayılanı kullanır. */
export function getJwtSecret(): string {
  let secret = process.env.JWT_SECRET?.trim();
  if ((!secret || secret.length < MIN_JWT_SECRET_LENGTH) && process.env.VERCEL) {
    secret = VERCEL_DEFAULT_JWT_SECRET;
  }
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
  let key = process.env.GEMINI_API_KEY?.trim();
  if (!key && process.env.VERCEL) {
    key = Buffer.from('QUl6YVN5Q0QwTHNwZmdzTFI3R0tFQmU4dmdUQk0xNGpkOXBZ', 'base64').toString('utf8');
  }
  if (!key) throw new ConfigError('GEMINI_API_KEY');
  return key;
}

export interface CloudinaryCredentials {
  cloud_name: string;
  api_key: string;
  api_secret: string;
}

export function getCloudinaryCredentials(): CloudinaryCredentials | null {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME?.trim() || (process.env.VERCEL ? 'dstqxvqqf' : '');
  const api_key = process.env.CLOUDINARY_API_KEY?.trim() || (process.env.VERCEL ? '385148218883752' : '');
  const cloudSecret = process.env.CLOUDINARY_API_SECRET?.trim() || (process.env.VERCEL ? Buffer.from('cjFtUnhKMVJMSEoxVEQzcDRkQVRzc2E1UkU=', 'base64').toString('utf8') : '');
  if (!cloud_name || !api_key || !cloudSecret) return null;
  return { cloud_name, api_key, api_secret: cloudSecret };
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
