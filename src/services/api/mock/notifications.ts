import type { AppNotification, NotificationPreferences, NotificationType, PushSubscriptionInput } from '@/types';
import { ApiError } from '@/services/api/types';
import type { NotificationsApi } from '@/services/api/types';
import {
  createDefaultNotificationPreferences,
  mergeNotificationPreferences,
  shouldDeliverPushNotification,
} from '@/services/notifications/helpers';
import { validateNotificationPreferencesInput } from '@/services/notifications/validation';

export interface MockPushDelivery {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  createdAt: string;
}

export interface MockPushSubscriptionRecord extends PushSubscriptionInput {
  userId: string;
  id: string;
}

export interface MockNotificationsDb {
  notifications: AppNotification[];
  notificationPreferences: Map<string, NotificationPreferences>;
  pushDeliveries: MockPushDelivery[];
  pushSubscriptions: MockPushSubscriptionRecord[];
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getPreferencesForUser(db: MockNotificationsDb, userId: string): NotificationPreferences {
  const existing = db.notificationPreferences.get(userId);
  if (existing) return existing;

  const created = createDefaultNotificationPreferences(userId);
  db.notificationPreferences.set(userId, created);
  return created;
}

export function tryPushNotification(
  db: MockNotificationsDb,
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  link?: string,
): void {
  const createdAt = new Date().toISOString();

  db.notifications.push({
    id: uid('notif'),
    userId,
    type,
    title,
    body,
    read: false,
    createdAt,
    link,
  });

  const preferences = getPreferencesForUser(db, userId);
  const hasSubscription = db.pushSubscriptions.some((s) => s.userId === userId);
  if (shouldDeliverPushNotification(preferences) && hasSubscription) {
    db.pushDeliveries.push({
      userId,
      type,
      title,
      body,
      link,
      createdAt,
    });
  }
}

export function createMockNotificationsApi(
  db: MockNotificationsDb,
  delay: (ms?: number) => Promise<void>,
  getUserById: (id: string) => unknown,
): NotificationsApi {
  function assertKnownUser(requesterId: string) {
    if (!getUserById(requesterId)) {
      throw new ApiError('Пользователь не найден', 'NOT_FOUND', 404);
    }
  }

  return {
    async getNotifications(userId) {
      await delay();
      return db.notifications
        .filter((n) => n.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async markAsRead(id, userId) {
      await delay(50);
      const n = db.notifications.find((x) => x.id === id && x.userId === userId);
      if (n) n.read = true;
    },

    async markAllAsRead(userId) {
      await delay(50);
      db.notifications.filter((n) => n.userId === userId).forEach((n) => (n.read = true));
    },

    async getPreferences(requesterId) {
      await delay();
      assertKnownUser(requesterId);
      return structuredClone(getPreferencesForUser(db, requesterId));
    },

    async updatePreferences(requesterId, input) {
      await delay();
      assertKnownUser(requesterId);

      const validationError = validateNotificationPreferencesInput(input);
      if (validationError) {
        throw new ApiError(validationError, 'VALIDATION', 400);
      }

      const current = getPreferencesForUser(db, requesterId);
      const updated = mergeNotificationPreferences(current, input);
      db.notificationPreferences.set(requesterId, updated);
      return structuredClone(updated);
    },

    async registerPushSubscription(requesterId, input: PushSubscriptionInput) {
      await delay();
      assertKnownUser(requesterId);

      if (!input.endpoint?.trim() || !input.keys?.p256dh?.trim() || !input.keys?.auth?.trim()) {
        throw new ApiError('Некорректная push-подписка', 'VALIDATION', 400);
      }

      const existingIdx = db.pushSubscriptions.findIndex(
        (s) => s.userId === requesterId && s.endpoint === input.endpoint,
      );

      const record: MockPushSubscriptionRecord = {
        id: existingIdx >= 0 ? db.pushSubscriptions[existingIdx].id : uid('push-sub'),
        userId: requesterId,
        endpoint: input.endpoint,
        keys: { p256dh: input.keys.p256dh, auth: input.keys.auth },
        userAgent: input.userAgent,
      };

      if (existingIdx >= 0) {
        db.pushSubscriptions[existingIdx] = record;
      } else {
        db.pushSubscriptions.push(record);
      }
    },

    async unregisterPushSubscription(requesterId, endpoint) {
      await delay();
      assertKnownUser(requesterId);

      db.pushSubscriptions = db.pushSubscriptions.filter((s) => {
        if (s.userId !== requesterId) return true;
        if (endpoint) return s.endpoint !== endpoint;
        return false;
      });
    },

    async hasPushSubscription(requesterId) {
      await delay();
      assertKnownUser(requesterId);
      return db.pushSubscriptions.some((s) => s.userId === requesterId);
    },
  };
}
