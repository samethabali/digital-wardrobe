import { apiFetch } from './api';

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

/** Tarayıcıyı günlük kombin bildirimlerine abone eder. Sunucuda bildirim rızası verilmiş olmalı. */
export async function subscribeToPush(): Promise<void> {
  if (!pushSupported()) throw new Error('Bu tarayıcı bildirimleri desteklemiyor.');
  const { enabled, publicKey } = await apiFetch<{ enabled: boolean; publicKey: string | null }>('/api/push/public-key');
  if (!enabled || !publicKey) throw new Error('Bildirimler şu an sunucuda etkin değil.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Tarayıcı bildirim izni verilmedi.');

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
  });
  await apiFetch('/api/push/subscribe', { body: subscription.toJSON() });
}

export async function unsubscribeFromPush(): Promise<void> {
  if (pushSupported()) {
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      await apiFetch('/api/push/subscribe', { method: 'DELETE', body: { endpoint: subscription.endpoint } }).catch(() => undefined);
      await subscription.unsubscribe();
      return;
    }
  }
  await apiFetch('/api/push/subscribe', { method: 'DELETE', body: {} }).catch(() => undefined);
}
