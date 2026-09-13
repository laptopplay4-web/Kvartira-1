import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isWebPushSupported,
  urlBase64ToUint8Array,
  getWebPushClientState,
  getServiceWorkerRegistration,
  getActivePushSubscription,
} from '@/services/push/helpers';
import {
  PUSH_NOT_CONFIGURED_MESSAGE,
  PUSH_UNSUPPORTED_MESSAGE,
} from '@/services/push/constants';
import {
  createMockNotificationsApi,
  tryPushNotification,
  type MockPushSubscriptionRecord,
} from '@/services/api/mock/notifications';
import {
  createDefaultNotificationPreferences,
} from '@/services/notifications/helpers';
import { users } from '@/mocks/seed';
import type { AppNotification } from '@/types';

const student = users.find((u) => u.id === 'user-student')!;

const demoSubscription: MockPushSubscriptionRecord = {
  id: 'push-sub-1',
  userId: student.id,
  endpoint: 'https://push.example.com/sub/1',
  keys: { p256dh: 'key', auth: 'secret' },
};

function createTestDb() {
  return {
    notifications: [] as AppNotification[],
    notificationPreferences: new Map(),
    pushDeliveries: [],
    pushSubscriptions: [demoSubscription],
  };
}

describe('web push helpers', () => {
  it('reports unsupported in test environment', () => {
    expect(isWebPushSupported()).toBe(false);
    const state = getWebPushClientState();
    expect(state.supported).toBe(false);
    expect(state.permission).toBe('unsupported');
  });

  it('decodes base64url vapid key', () => {
    const bytes = urlBase64ToUint8Array('AQID');
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
  });

  it('resolves null when no service worker is registered (no hang)', async () => {
    const ready = new Promise<ServiceWorkerRegistration>(() => {
      /* never settles — mirrors browsers with no SW */
    });
    const getRegistration = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistration,
        ready,
      },
    });

    await expect(getServiceWorkerRegistration(50)).resolves.toBeNull();
    await expect(getActivePushSubscription()).resolves.toBeNull();
    expect(getRegistration).toHaveBeenCalled();
  });

  it('exposes distinct unavailable copy for missing VAPID vs unsupported browser', () => {
    expect(PUSH_NOT_CONFIGURED_MESSAGE).toMatch(/VAPID/i);
    expect(PUSH_UNSUPPORTED_MESSAGE).toMatch(/браузере/i);
  });
});

describe('push subscription API', () => {
  const delay = async () => {};
  let db = createTestDb();
  let api: ReturnType<typeof createMockNotificationsApi>;

  beforeEach(() => {
    db = createTestDb();
    api = createMockNotificationsApi(db, delay, (id) => users.find((u) => u.id === id));
  });

  it('registers and checks subscription', async () => {
    await api.registerPushSubscription(student.id, {
      endpoint: 'https://push.example.com/sub/2',
      keys: { p256dh: 'a', auth: 'b' },
    });
    expect(await api.hasPushSubscription(student.id)).toBe(true);
    expect(db.pushSubscriptions).toHaveLength(2);
  });

  it('unregisters by endpoint', async () => {
    await api.unregisterPushSubscription(student.id, demoSubscription.endpoint);
    expect(await api.hasPushSubscription(student.id)).toBe(false);
  });

  it('delivers push only with active subscription', () => {
    tryPushNotification(db, student.id, 'lesson', 'Занятие', 'Тест');
    expect(db.pushDeliveries).toHaveLength(1);

    db.pushSubscriptions = [];
    tryPushNotification(db, student.id, 'message', 'Сообщение', 'Тест');
    expect(db.pushDeliveries).toHaveLength(1);
    expect(db.notifications).toHaveLength(2);
  });

  it('skips push when preference disabled even with subscription', () => {
    db.notificationPreferences.set(student.id, {
      ...createDefaultNotificationPreferences(student.id),
      pushEnabled: false,
    });
    tryPushNotification(db, student.id, 'lesson', 'Занятие', 'Тест');
    expect(db.notifications).toHaveLength(1);
    expect(db.pushDeliveries).toHaveLength(0);
  });
});
