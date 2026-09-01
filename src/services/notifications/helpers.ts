import type { NotificationPreferences, UpdateNotificationPreferencesInput } from '@/types';

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
