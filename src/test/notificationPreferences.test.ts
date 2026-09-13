import { describe, it, expect, beforeEach } from 'vitest';
import {
  countInboxUnreadNotifications,
  createDefaultNotificationPreferences,
  didLeaveNotificationsRoute,
  isPassiveUnreadNotification,
  markPassiveNotificationsReadInList,
  isMessageNotificationForChat,
  markChatMessageNotificationsReadInList,
  mergeNotificationPreferences,
  notificationRequiresAction,
  shouldDeliverPushNotification,
  showsInNotificationsInbox,
  sortNotificationsChronologically,
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

  it('treats assignment notifications as requiring open (not leave-read)', () => {
    expect(notificationRequiresAction({ type: 'assignment' })).toBe(true);
    expect(notificationRequiresAction({ type: 'lesson' })).toBe(false);
    expect(isPassiveUnreadNotification({ read: false, type: 'assignment' })).toBe(false);
  });

  it('hides assignment from notifications inbox but keeps for book badge', () => {
    expect(showsInNotificationsInbox({ type: 'assignment' })).toBe(false);
    expect(showsInNotificationsInbox({ type: 'lesson' })).toBe(true);
    expect(
      countInboxUnreadNotifications([
        { read: false, type: 'assignment' },
        { read: false, type: 'lesson' },
        { read: true, type: 'message' },
      ]),
    ).toBe(1);
  });

  it('hides event participation from inbox and requires open to clear', () => {
    expect(showsInNotificationsInbox({ type: 'event' })).toBe(false);
    expect(notificationRequiresAction({ type: 'event' })).toBe(true);
    expect(isPassiveUnreadNotification({ read: false, type: 'event' })).toBe(false);
    expect(
      countInboxUnreadNotifications([
        { read: false, type: 'event' },
        { read: false, type: 'lesson' },
      ]),
    ).toBe(1);
  });

  it('hides admin help/report alerts from bell (profile badge instead)', () => {
    expect(showsInNotificationsInbox({ type: 'system', link: '/admin/help/t1' })).toBe(false);
    expect(showsInNotificationsInbox({ type: 'system', link: '/home' })).toBe(true);
    expect(
      countInboxUnreadNotifications([
        { read: false, type: 'system', link: '/admin/help/t1' },
        { read: false, type: 'system', link: '/admin/help/t1' },
        { read: false, type: 'lesson' },
      ]),
    ).toBe(1);
  });

  it('detects leave from notifications route', () => {
    expect(didLeaveNotificationsRoute('/notifications', '/home')).toBe(true);
    expect(didLeaveNotificationsRoute('/notifications', '/profile')).toBe(true);
    expect(didLeaveNotificationsRoute('/home', '/notifications')).toBe(false);
    expect(didLeaveNotificationsRoute('/notifications', '/notifications')).toBe(false);
    expect(didLeaveNotificationsRoute('/chat', '/home')).toBe(false);
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

  it('markChatMessageNotificationsReadInList only clears that chat', () => {
    const list: AppNotification[] = [
      {
        id: 'a',
        userId: student.id,
        type: 'message',
        title: 'Чат',
        body: '1',
        read: false,
        createdAt: '2026-01-01T10:00:00.000Z',
        link: '/chat/conv-1',
      },
      {
        id: 'b',
        userId: student.id,
        type: 'message',
        title: 'Чат',
        body: '2',
        read: false,
        createdAt: '2026-01-01T11:00:00.000Z',
        link: '/chat/conv-2',
      },
      {
        id: 'c',
        userId: student.id,
        type: 'lesson',
        title: 'Урок',
        body: '3',
        read: false,
        createdAt: '2026-01-01T12:00:00.000Z',
        link: '/lessons/1',
      },
    ];
    const next = markChatMessageNotificationsReadInList(list, 'conv-1');
    expect(next.find((n) => n.id === 'a')?.read).toBe(true);
    expect(next.find((n) => n.id === 'b')?.read).toBe(false);
    expect(next.find((n) => n.id === 'c')?.read).toBe(false);
    expect(isMessageNotificationForChat(list[0]!, 'conv-1')).toBe(true);
    expect(isMessageNotificationForChat(list[1]!, 'conv-1')).toBe(false);
  });

  it('sorts notifications newest first by createdAt', () => {
    const list: AppNotification[] = [
      {
        id: 'old',
        userId: student.id,
        type: 'lesson',
        title: 'Old',
        body: 'b',
        read: true,
        createdAt: '2026-01-01T10:00:00.000Z',
      },
      {
        id: 'new',
        userId: student.id,
        type: 'message',
        title: 'New',
        body: 'b',
        read: false,
        createdAt: '2026-01-02T10:00:00.000Z',
      },
      {
        id: 'mid',
        userId: student.id,
        type: 'event',
        title: 'Mid',
        body: 'b',
        read: false,
        createdAt: '2026-01-01T18:00:00.000Z',
      },
    ];
    const sorted = sortNotificationsChronologically(list);
    expect(sorted.map((n) => n.id)).toEqual(['new', 'mid', 'old']);
  });

  it('getNotifications returns chronological order', async () => {
    const delay = async () => {};
    const db = {
      notifications: [
        {
          id: 'n1',
          userId: student.id,
          type: 'lesson' as const,
          title: 'Older',
          body: 'b',
          read: false,
          createdAt: '2026-03-01T08:00:00.000Z',
        },
        {
          id: 'n2',
          userId: student.id,
          type: 'message' as const,
          title: 'Newer',
          body: 'b',
          read: false,
          createdAt: '2026-03-02T08:00:00.000Z',
        },
      ] as AppNotification[],
      notificationPreferences: new Map(),
      pushDeliveries: [],
      pushSubscriptions: [] as MockPushSubscriptionRecord[],
    };
    const api = createMockNotificationsApi(db, delay, (id) => users.find((u) => u.id === id));
    const list = await api.getNotifications(student.id);
    expect(list.map((n) => n.id)).toEqual(['n2', 'n1']);
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
    tryPushNotification(db, student.id, 'assignment', 'Новое ДЗ', 'Материалы', '/assignments/asgn-1');
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

    expect(studentNotifs.find((n) => n.type === 'lesson')?.read).toBe(true);
    expect(studentNotifs.find((n) => n.type === 'assignment')?.read).toBe(false);
    expect(teacherNotifs.find((n) => n.urgent)?.read).toBe(false);
    expect(teacherNotifs.find((n) => !n.urgent)?.read).toBe(true);
  });
});
