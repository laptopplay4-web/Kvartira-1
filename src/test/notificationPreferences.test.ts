import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDefaultNotificationPreferences,
  mergeNotificationPreferences,
  shouldDeliverPushNotification,
} from '@/services/notifications/helpers';
import { validateNotificationPreferencesInput } from '@/services/notifications/validation';
import { createMockNotificationsApi, tryPushNotification, type MockPushSubscriptionRecord } from '@/services/api/mock/notifications';
import { users } from '@/mocks/seed';
import type { AppNotification } from '@/types';
import { ApiError } from '@/services/api/types';

const student = users.find((u) => u.id === 'user-student')!;

function createTestDb() {
  return {
    notifications: [] as AppNotification[],
    notificationPreferences: new Map(),
    pushDeliveries: [],
    pushSubscriptions: [] as MockPushSubscriptionRecord[],
  };
}

describe('notification preferences helpers', () => {
  it('enables push by default', () => {
    const prefs = createDefaultNotificationPreferences(student.id);
    expect(prefs.pushEnabled).toBe(true);
    expect(shouldDeliverPushNotification(prefs)).toBe(true);
  });

  it('merges push toggle', () => {
    const current = createDefaultNotificationPreferences(student.id);
    const merged = mergeNotificationPreferences(current, { pushEnabled: false });
    expect(merged.pushEnabled).toBe(false);
  });
});

describe('notification preferences validation', () => {
  it('rejects empty update', () => {
    expect(validateNotificationPreferencesInput({})).toBeTruthy();
  });
});

describe('notification preferences API', () => {
  const delay = async () => {};
  let db = createTestDb();
  let api: ReturnType<typeof createMockNotificationsApi>;

  beforeEach(() => {
    db = createTestDb();
    api = createMockNotificationsApi(db, delay, (id) => users.find((u) => u.id === id));
  });

  it('returns defaults for new user', async () => {
    const prefs = await api.getPreferences(student.id);
    expect(prefs.pushEnabled).toBe(true);
  });

  it('updates push toggle', async () => {
    const updated = await api.updatePreferences(student.id, { pushEnabled: false });
    expect(updated.pushEnabled).toBe(false);
  });

  it('rejects unknown user', async () => {
    await expect(api.getPreferences('unknown-user')).rejects.toBeInstanceOf(ApiError);
    await expect(api.updatePreferences('unknown-user', { pushEnabled: false })).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it('always creates in-app notification and push only when enabled and subscribed', () => {
    db.pushSubscriptions.push({
      id: 'sub-1',
      userId: student.id,
      endpoint: 'https://push.example.com/x',
      keys: { p256dh: 'a', auth: 'b' },
    });

    tryPushNotification(db, student.id, 'lesson', 'Занятие', 'Тест');
    expect(db.notifications).toHaveLength(1);
    expect(db.pushDeliveries).toHaveLength(1);

    db.notificationPreferences.set(student.id, {
      ...createDefaultNotificationPreferences(student.id),
      pushEnabled: false,
    });

    tryPushNotification(db, student.id, 'message', 'Сообщение', 'Тест');
    expect(db.notifications).toHaveLength(2);
    expect(db.pushDeliveries).toHaveLength(1);
  });
});
