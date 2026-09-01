import type { PushSubscriptionInput, WebPushClientState } from '@/types';
import { VAPID_PUBLIC_KEY_ENV } from './constants';

export function isWebPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function getVapidPublicKey(): string | undefined {
  const key = import.meta.env[VAPID_PUBLIC_KEY_ENV]?.trim();
  return key || undefined;
}

export function isWebPushConfigured(): boolean {
  return Boolean(getVapidPublicKey());
}

export function getWebPushClientState(): WebPushClientState {
  if (!isWebPushSupported()) {
    return { supported: false, permission: 'unsupported', subscribed: false, configured: false };
  }

  return {
    supported: true,
    permission: Notification.permission,
    subscribed: false,
    configured: isWebPushConfigured(),
  };
}

/** base64url → Uint8Array for applicationServerKey */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export function subscriptionToInput(subscription: PushSubscription): PushSubscriptionInput {
  const json = subscription.toJSON();
  const keys = json.keys;
  if (!json.endpoint || !keys?.p256dh || !keys?.auth) {
    throw new Error('Некорректная push-подписка');
  }

  return {
    endpoint: json.endpoint,
    keys: { p256dh: keys.p256dh, auth: keys.auth },
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  };
}

export async function getActivePushSubscription(): Promise<PushSubscription | null> {
  if (!isWebPushSupported()) return null;

  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function subscribeToWebPush(): Promise<PushSubscription> {
  const vapidKey = getVapidPublicKey();
  if (!vapidKey) {
    throw new Error('Push не настроен на сервере');
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });
}

export async function unsubscribeFromWebPush(): Promise<void> {
  const subscription = await getActivePushSubscription();
  if (subscription) {
    await subscription.unsubscribe();
  }
}
