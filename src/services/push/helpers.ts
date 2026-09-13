import type { PushSubscriptionInput, WebPushClientState } from '@/types';
import { SERVICE_WORKER_READY_TIMEOUT_MS, VAPID_PUBLIC_KEY_ENV } from './constants';

export type EnablePushStatus = 'subscribed' | 'unavailable' | 'failed';

export interface EnablePushResult {
  status: EnablePushStatus;
  message?: string;
}

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

/**
 * Resolve SW registration without hanging: `navigator.serviceWorker.ready`
 * never settles when no worker is registered (common in Vite dev).
 */
export async function getServiceWorkerRegistration(
  timeoutMs = SERVICE_WORKER_READY_TIMEOUT_MS,
): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;
  } catch {
    return null;
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: ServiceWorkerRegistration | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    const timer = setTimeout(() => {
      void navigator.serviceWorker.getRegistration().then((reg) => finish(reg ?? null), () => finish(null));
    }, timeoutMs);

    void navigator.serviceWorker.ready.then(
      (reg) => finish(reg),
      () => finish(null),
    );
  });
}

export async function getActivePushSubscription(): Promise<PushSubscription | null> {
  if (!isWebPushSupported()) return null;

  const registration = await getServiceWorkerRegistration();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

export async function subscribeToWebPush(): Promise<PushSubscription> {
  const vapidKey = getVapidPublicKey();
  if (!vapidKey) {
    throw new Error('Push не настроен на сервере');
  }

  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    throw new Error('Service Worker ещё не готов');
  }

  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  const applicationServerKey = urlBase64ToUint8Array(vapidKey) as BufferSource;
  try {
    return await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  } catch (firstError) {
    // Chrome иногда отказывает сразу после unsubscribe — один короткий retry.
    await new Promise((r) => setTimeout(r, 350));
    try {
      return await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    } catch {
      throw firstError;
    }
  }
}

export async function unsubscribeFromWebPush(): Promise<void> {
  const subscription = await getActivePushSubscription();
  if (subscription) {
    await subscription.unsubscribe();
  }
}
