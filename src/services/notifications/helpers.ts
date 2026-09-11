import type {
  AppNotification,
  NotificationPreferences,
  UpdateNotificationPreferencesInput,
} from '@/types';

export function createDefaultNotificationPreferences(userId: string): NotificationPreferences {
  return {
    userId,
    pushEnabled: true,
  };
}

export function shouldDeliverPushNotification(preferences: NotificationPreferences): boolean {
  return preferences.pushEnabled;
}

export function mergeNotificationPreferences(
  current: NotificationPreferences,
  input: UpdateNotificationPreferencesInput,
): NotificationPreferences {
  return {
    userId: current.userId,
    pushEnabled: input.pushEnabled ?? current.pushEnabled,
  };
}

/** Срочные / требующие действия — не автопрочитываются при уходе со вкладки. */
export function notificationRequiresAction(n: Pick<AppNotification, 'urgent'>): boolean {
  return n.urgent === true;
}

/** Непрочитанные без обязательного действия — помечаются прочитанными при leave. */
export function isPassiveUnreadNotification(
  n: Pick<AppNotification, 'read' | 'urgent'>,
): boolean {
  return !n.read && !notificationRequiresAction(n);
}

export function markPassiveNotificationsReadInList<T extends Pick<AppNotification, 'read' | 'urgent'>>(
  list: T[],
): T[] {
  return list.map((n) => (isPassiveUnreadNotification(n) ? { ...n, read: true } : n));
}
