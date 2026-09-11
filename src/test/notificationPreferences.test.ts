import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDefaultNotificationPreferences,
  isPassiveUnreadNotification,
  markPassiveNotificationsReadInList,
  mergeNotificationPreferences,
  notificationRequiresAction,
  shouldDeliverPushNotification,
} from '@/services/notifications/helpers';
import { validateNotificationPreferencesInput } from '@/services/notifications/validation';
import {
  createMockNotificationsApi,
  tryPushNotification,
  type MockPushSubscriptionRecord,
} from '@/services/api/mock/notifications';
import { users } from '@/mocks/seed';
import type { AppNotification } from '@/types';
import { ApiError } from '@/services/api/types';
import {
  TEACHER_DIRECTIONS_SETUP_LINK,
  TEACHER_DIRECTIONS_SETUP_TITLE,
} from '@/services/directions/constants';

const student = users.find((u) => u.id === 'user-student')!;
const teacher = users.find((u) => u.id === 'user-teacher-1')!;

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

describe('notification read helpers', () => {
  it('treats urgent as requiring action', () => {
    expect(notificationRequiresAction({ urgent: true })).toBe(true);
    expect(notificationRequiresAction({ urgent: false })).toBe(false);
    expect(notificationRequiresAction({})).toBe(false);
  });

  it('passive unread excludes urgent and already-read', () => {
    expect(isPassiveUnreadNotification({ read: false })).toBe(true);
    expect(isPassiveUnreadNotification({ read: false, urgent: true })).toBe(false);
    expect(isPassiveUnreadNotification({ read: true })).toBe(false);
  });

  it('markPassiveNotificationsReadInList keeps urgent unread', () => {
    const list: AppNotification[] = [
      {
        id: 'a',
        userId: student.id,
        type: 'lesson',
        title: 'A',
        body: 'b',
        read: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'b',
        userId: student.id,
        type: 'system',
        title: TEACHER_DIRECTIONS_SETUP_TITLE,
        body: 'x',
        read: false,
        urgent: true,
        link: TEACHER_DIRECTIONS_SETUP_LINK,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    const next = markPassiveNotificationsReadInList(list);
    expect(next[0].read).toBe(true);
    expect(next[1].read).toBe(false);
    expect(list[0].read).toBe(false);
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
    await expect(
      api.updatePreferences('unknown-user', { pushEnabled: false }),
    ).rejects.toBeInstanceOf(ApiError);
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

  it('markAllAsRead marks only passive notifications', async () => {
    tryPushNotification(db, student.id, 'lesson', 'Занятие', 'Обычное');
    tryPushNotification(
      db,
      teacher.id,
      'system',
      TEACHER_DIRECTIONS_SETUP_TITLE,
      'Нужно действие',
      TEACHER_DIRECTIONS_SETUP_LINK,
      true,
    );
    tryPushNotification(db, teacher.id, 'message', 'Сообщение', 'Пассивное');

    await api.markAllAsRead(teacher.id);
    await api.markAllAsRead(student.id);

    const teacherNotifs = await api.getNotifications(teacher.id);
    const studentNotifs = await api.getNotifications(student.id);

    expect(studentNotifs.every((n) => n.read)).toBe(true);
    expect(teacherNotifs.find((n) => n.urgent)?.read).toBe(false);
    expect(teacherNotifs.find((n) => !n.urgent)?.read).toBe(true);
  });
});
