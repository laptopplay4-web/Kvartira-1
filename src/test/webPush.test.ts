import { describe, it, expect, beforeEach } from 'vitest';
import {
  isWebPushSupported,
  urlBase64ToUint8Array,
  getWebPushClientState,
} from '@/services/push/helpers';
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
