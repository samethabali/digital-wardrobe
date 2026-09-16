import webpush from 'web-push';
import { PushSubscriptionModel } from './db.js';
import { getVapidConfig } from './config.js';
import { RequestError } from './engine/request.js';

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

export interface StoredSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

type Sender = (subscription: StoredSubscription, payload: string) => Promise<void>;

const defaultSender: Sender = async (subscription, payload) => {
  const vapid = getVapidConfig();
  if (!vapid) throw new Error('VAPID anahtarları tanımlı değil');
  await webpush.sendNotification(subscription, payload, {
    vapidDetails: { subject: vapid.subject, publicKey: vapid.publicKey, privateKey: vapid.privateKey },
    TTL: 6 * 60 * 60,
  });
};
let sender: Sender = defaultSender;

export function setPushSenderForTests(fake: Sender | null) {
  sender = fake || defaultSender;
}

export function pushPublicKey(): string | null {
  return getVapidConfig()?.publicKey || null;
}

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

/** Tarayıcıdan gelen PushSubscription JSON'unu doğrular. Yalnızca https push servisleri kabul edilir. */
export function sanitizeSubscription(raw: any): StoredSubscription {
  const endpoint = raw?.endpoint;
  let url: URL | null = null;
  try { url = typeof endpoint === 'string' && endpoint.length <= 1000 ? new URL(endpoint) : null; } catch { url = null; }
  if (!url || url.protocol !== 'https:') throw new RequestError('Geçersiz bildirim aboneliği.');
  const p256dh = raw?.keys?.p256dh;
  const auth = raw?.keys?.auth;
  if (typeof p256dh !== 'string' || typeof auth !== 'string' || p256dh.length > 200 || auth.length > 100
    || !BASE64URL.test(p256dh) || !BASE64URL.test(auth)) {
    throw new RequestError('Geçersiz bildirim anahtarları.');
  }
  return { endpoint, keys: { p256dh, auth } };
}

export async function saveSubscription(userId: unknown, subscription: StoredSubscription) {
  // Aynı tarayıcı başka bir hesapla abone olduysa abonelik yeni hesaba geçer
  await PushSubscriptionModel.updateOne(
    { endpoint: subscription.endpoint } as any,
    { $set: { userId, keys: subscription.keys }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true },
  );
}

export async function removeSubscription(userId: unknown, endpoint?: string) {
  await PushSubscriptionModel.deleteMany({ userId, ...(endpoint ? { endpoint } : {}) } as any);
}

/** Kullanıcının tüm aboneliklerine bildirim gönderir; süresi dolmuş (404/410) abonelikleri siler. */
export async function sendPushToUser(userId: unknown, payload: PushPayload): Promise<{ sent: number; removed: number; failed: number }> {
  const subscriptions: any[] = await PushSubscriptionModel.find({ userId } as any).lean();
  const body = JSON.stringify(payload);
  let sent = 0, removed = 0, failed = 0;
  for (const sub of subscriptions) {
    try {
      await sender({ endpoint: sub.endpoint, keys: sub.keys }, body);
      sent++;
    } catch (err: any) {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await PushSubscriptionModel.deleteOne({ _id: sub._id } as any);
        removed++;
      } else {
        failed++;
        console.warn('[Push] Bildirim gönderilemedi:', err?.statusCode || err?.message);
      }
    }
  }
  return { sent, removed, failed };
}
