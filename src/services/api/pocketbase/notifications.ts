import { ClientResponseError } from 'pocketbase';
import type { NotificationsApi } from '@/services/api/types';
import { ApiError } from '@/services/api/types';
import { getPocketBase } from '@/services/api/pocketbase/client';
import { withPbError } from '@/services/api/pocketbase/errors';
import { emptyToUndefined, escapePbFilter } from '@/services/api/pocketbase/helpers';
import {
  mapNotificationPreferencesRecord,
  mapNotificationRecord,
  mapUserRecord,
} from '@/services/api/pocketbase/mappers';
import {
  createDefaultNotificationPreferences,
  mergeNotificationPreferences,
} from '@/services/notifications/helpers';
import { validateNotificationPreferencesInput } from '@/services/notifications/validation';
import type { PushSubscriptionInput, UpdateNotificationPreferencesInput, User } from '@/types';

async function getRequesterUser(userId: string): Promise<User> {
  const pb = getPocketBase();
  try {
    const record = await pb.collection('users').getOne(userId);
    return mapUserRecord(record);
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      throw new ApiError('Пользователь не найден', 'NOT_FOUND', 404);
    }
    throw error;
  }
}

function userFilter(userId: string): string {
  return `user = "${escapePbFilter(userId)}"`;
}

async function loadNotificationOrThrow(id: string, userId: string) {
  const pb = getPocketBase();
  try {
    const record = await pb.collection('notifications').getOne(id);
    const notification = mapNotificationRecord(record);
    if (notification.userId !== userId) {
      throw new ApiError('Уведомление не найдено', 'NOT_FOUND', 404);
    }
    return notification;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof ClientResponseError && error.status === 404) {
      throw new ApiError('Уведомление не найдено', 'NOT_FOUND', 404);
    }
    throw error;
  }
}

async function getPreferencesRecord(requesterId: string) {
  const pb = getPocketBase();
  const records = await pb.collection('notification_preferences').getList(1, 1, {
    filter: userFilter(requesterId),
  });
  if (records.items[0]) {
    return records.items[0];
  }

  const defaults = createDefaultNotificationPreferences(requesterId);
  try {
    return await pb.collection('notification_preferences').create({
      user: requesterId,
      pushEnabled: defaults.pushEnabled,
      categories: {},
      channels: {},
    });
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 400) {
      const retry = await pb.collection('notification_preferences').getList(1, 1, {
        filter: userFilter(requesterId),
      });
      if (retry.items[0]) return retry.items[0];
    }
    throw error;
  }
}

export const pocketbaseNotificationsApi: NotificationsApi = {
  async getNotifications(userId) {
    return withPbError(async () => {
      await getRequesterUser(userId);

      const pb = getPocketBase();
      const records = await pb.collection('notifications').getFullList({
        filter: userFilter(userId),
        sort: '-id',
      });
      return records.map(mapNotificationRecord);
    });
  },

  async markAsRead(id, userId) {
    return withPbError(async () => {
      await loadNotificationOrThrow(id, userId);

      const pb = getPocketBase();
      await pb.collection('notifications').update(id, { read: true });
    });
  },

  async markAllAsRead(userId) {
    return withPbError(async () => {
      await getRequesterUser(userId);

      const pb = getPocketBase();
      const records = await pb.collection('notifications').getFullList({
        filter: `${userFilter(userId)} && read = false`,
      });

      for (const record of records) {
        await pb.collection('notifications').update(record.id, { read: true });
      }
    });
  },

  async getPreferences(requesterId) {
    return withPbError(async () => {
      await getRequesterUser(requesterId);
      const record = await getPreferencesRecord(requesterId);
      return mapNotificationPreferencesRecord(record);
    });
  },

  async updatePreferences(requesterId, input: UpdateNotificationPreferencesInput) {
    return withPbError(async () => {
      await getRequesterUser(requesterId);

      const validationError = validateNotificationPreferencesInput(input);
      if (validationError) {
        throw new ApiError(validationError, 'VALIDATION', 400);
      }

      const record = await getPreferencesRecord(requesterId);
      const current = mapNotificationPreferencesRecord(record);
      const updated = mergeNotificationPreferences(current, input);

      const pb = getPocketBase();
      const saved = await pb.collection('notification_preferences').update(record.id, {
        pushEnabled: updated.pushEnabled,
      });
      return mapNotificationPreferencesRecord(saved);
    });
  },

  async registerPushSubscription(requesterId, input: PushSubscriptionInput) {
    return withPbError(async () => {
      await getRequesterUser(requesterId);

      if (!input.endpoint?.trim() || !input.keys?.p256dh?.trim() || !input.keys?.auth?.trim()) {
        throw new ApiError('Некорректная push-подписка', 'VALIDATION', 400);
      }

      const pb = getPocketBase();
      const filter = `${userFilter(requesterId)} && endpoint = "${escapePbFilter(input.endpoint)}"`;
      const existing = await pb.collection('push_subscriptions').getList(1, 1, { filter });

      const payload = {
        user: requesterId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: emptyToUndefined(input.userAgent),
      };

      if (existing.items[0]) {
        await pb.collection('push_subscriptions').update(existing.items[0].id, payload);
      } else {
        await pb.collection('push_subscriptions').create(payload);
      }
    });
  },

  async unregisterPushSubscription(requesterId, endpoint) {
    return withPbError(async () => {
      await getRequesterUser(requesterId);

      const pb = getPocketBase();
      let filter = userFilter(requesterId);
      if (endpoint?.trim()) {
        filter += ` && endpoint = "${escapePbFilter(endpoint)}"`;
      }

      const records = await pb.collection('push_subscriptions').getFullList({ filter });
      for (const record of records) {
        await pb.collection('push_subscriptions').delete(record.id);
      }
    });
  },

  async hasPushSubscription(requesterId) {
    return withPbError(async () => {
      await getRequesterUser(requesterId);

      const pb = getPocketBase();
      const records = await pb.collection('push_subscriptions').getList(1, 1, {
        filter: userFilter(requesterId),
      });
      return records.totalItems > 0;
    });
  },
};
