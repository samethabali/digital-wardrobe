import express from 'express';
import jwt from 'jsonwebtoken';
import { RateLimitModel } from './db.js';
import { ConfigError, getJwtSecret } from './config.js';
import { AiError } from './ai/gemini.js';

// ─── Kimlik doğrulama ──────────────────────────────────────────────────────
export interface TokenUser {
  id: string;
  email: string;
  username: string;
  name: string;
  isPrivate: boolean;
}

export function signToken(user: any): string {
  const payload: TokenUser = {
    id: user._id.toString(),
    email: user.email,
    username: user.username || '',
    name: user.name,
    isPrivate: user.isPrivate || false,
  };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '30d', algorithm: 'HS256' });
}

export function publicUser(user: any): TokenUser {
  return {
    id: user._id.toString(),
    email: user.email,
    username: user.username || '',
    name: user.name,
    isPrivate: user.isPrivate || false,
  };
}

/** Yapılandırma eksikse (ör. JWT_SECRET) ayrıntıyı loglar, istemciye genel bir 503 döner. */
export function sendConfigError(res: express.Response, err: unknown): boolean {
  if (!(err instanceof ConfigError)) return false;
  console.error('[Config]', err.message);
  res.status(503).json({ error: 'Sunucu yapılandırması eksik. Lütfen daha sonra tekrar deneyin.' });
  return true;
}

export function authenticateToken(req: any, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = typeof authHeader === 'string' ? authHeader.split(' ')[1] : undefined; // Bearer <token>
  if (!token) {
    return res.status(401).json({ error: 'Erişim engellendi. Token eksik.' });
  }

  let secret: string;
  try {
    secret = getJwtSecret();
  } catch (err) {
    sendConfigError(res, err);
    return;
  }

  jwt.verify(token, secret, { algorithms: ['HS256'] }, (err: any, user: any) => {
    if (err || !user?.id) {
      return res.status(403).json({ error: 'Geçersiz veya süresi dolmuş token.' });
    }
    req.user = user;
    next();
  });
}

// ─── İstek sınırlama ───────────────────────────────────────────────────────
// Sayaçlar MongoDB'de tutulur; böylece Vercel'deki tüm serverless örnekleri aynı sınırı paylaşır.
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

export interface RateLimitRule { max: number; windowMs: number }

export const RATE_LIMITS = {
  register:        { max: 10, windowMs: HOUR },       // IP başına
  login:           { max: 10, windowMs: 15 * MINUTE }, // IP + e-posta başına
  generateOutfit:  { max: 60, windowMs: HOUR },       // Kullanıcı başına (aşağıdakilerin hepsi)
  analyzeImage:    { max: 60, windowMs: HOUR },
  upload:          { max: 60, windowMs: HOUR },
  capsuleAnalysis: { max: 20, windowMs: HOUR },
  collabGenerate:  { max: 20, windowMs: HOUR },
  enrich:          { max: 5,  windowMs: HOUR },
  feedback:        { max: 300, windowMs: HOUR },
  wearLog:         { max: 120, windowMs: HOUR },
  pairings:        { max: 60, windowMs: HOUR },
  dailyPick:       { max: 30, windowMs: HOUR },
  tripPlan:        { max: 20, windowMs: HOUR },
  cutout:          { max: 20, windowMs: HOUR },
  embeddings:      { max: 10, windowMs: HOUR },
  personalColor:   { max: 5,  windowMs: HOUR },
  push:            { max: 20, windowMs: HOUR },
} satisfies Record<string, RateLimitRule>;

// Vercel istemci IP'sini x-real-ip başlığına kendisi yazar; istemci bu değeri taklit edemez.
export function getClientIp(req: express.Request): string {
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

export function rateLimit(bucket: string, limit: RateLimitRule, getIdentity: (req: any) => string) {
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

export const byUser = (req: any) => req.user.id;
export const byIp = (req: any) => getClientIp(req);
export const byIpAndEmail = (req: any) => `${getClientIp(req)}:${String(req.body?.email || '').trim().toLowerCase()}`;

const AI_ERROR_STATUS: Record<string, number> = {
  bad_request: 400, blocked: 422, invalid_output: 502, timeout: 504, unavailable: 503, config: 503,
};

/** Motor, doğrulama ve yapay zeka hatalarını uygun HTTP koduna çevirir; beklenmeyen hataların ayrıntısını istemciye sızdırmaz. */
export function sendError(res: express.Response, err: any, fallback: string, logTag: string) {
  if (sendConfigError(res, err)) return;
  if (err instanceof AiError) {
    console.error(`[${logTag}] AI hatası (${err.code}):`, err.message);
    const message = err.code === 'config' ? 'Yapay zeka servisi şu an kullanılamıyor.' : err.message;
    res.status(AI_ERROR_STATUS[err.code] || 502).json({ error: message });
    return;
  }
  const status = typeof err?.status === 'number' && err.status >= 400 && err.status < 500 ? err.status : null;
  if (status) {
    res.status(status).json({ error: err.message || fallback });
    return;
  }
  console.error(`[${logTag}] Hata:`, err);
  res.status(500).json({ error: fallback });
}
