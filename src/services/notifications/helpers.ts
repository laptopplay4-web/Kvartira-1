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

/**
 * Не автопрочитываются при уходе со вкладки уведомлений:
 * срочные и уведомления о ДЗ (прочтение = открытие задания).
 */
export function notificationRequiresAction(
  n: Pick<AppNotification, 'urgent'> & Partial<Pick<AppNotification, 'type'>>,
): boolean {
  return n.urgent === true || n.type === 'assignment' || n.type === 'event';
}

/**
 * ДЗ, мероприятия и admin-обращения/жалобы не в колокольчике —
 * отдельные бейджи (книга / События / Профиль → Админ).
 */
export function showsInNotificationsInbox(
  n: Pick<AppNotification, 'type'> & Partial<Pick<AppNotification, 'link' | 'type'>>,
): boolean {
  if (n.type === 'assignment' || n.type === 'event') return false;
  if (isSupportAdminInboxNotification(n)) return false;
  return true;
}

/** Admin help inbox alerts (`/admin/help…`) — badge on Profile, not bell. */
export function isSupportAdminInboxNotification(
  n: Partial<Pick<AppNotification, 'link'>>,
): boolean {
  if (!n.link) return false;
  const path = n.link.split('?')[0]?.replace(/\/$/, '') ?? '';
  return path === '/admin/help' || path.startsWith('/admin/help/');
}

export function countInboxUnreadNotifications(
  notifications: (Pick<AppNotification, 'read' | 'type'> &
    Partial<Pick<AppNotification, 'link' | 'type'>>)[],
): number {
  return notifications.filter((n) => !n.read && showsInNotificationsInbox(n)).length;
}

export function isNotificationsRoute(pathname: string): boolean {
  return pathname === '/notifications' || pathname.startsWith('/notifications/');
}

/** true, если ушли с экрана уведомлений на другой маршрут. */
export function didLeaveNotificationsRoute(prevPath: string, nextPath: string): boolean {
  return isNotificationsRoute(prevPath) && !isNotificationsRoute(nextPath);
}

/** Непрочитанные без обязательного действия — помечаются прочитанными при leave. */
export function isPassiveUnreadNotification(
  n: Pick<AppNotification, 'read' | 'urgent'> & Partial<Pick<AppNotification, 'type'>>,
): boolean {
  return !n.read && !notificationRequiresAction(n);
}

export function markPassiveNotificationsReadInList<
  T extends Pick<AppNotification, 'read' | 'urgent'> & Partial<Pick<AppNotification, 'type'>>,
>(list: T[]): T[] {
  return list.map((n) => (isPassiveUnreadNotification(n) ? { ...n, read: true } : n));
}

/** In-app chat alerts: `type: message` with link `/chat/:conversationId`. */
export function isMessageNotificationForChat(
  n: Pick<AppNotification, 'type'> & Partial<Pick<AppNotification, 'link' | 'type'>>,
  conversationId: string,
): boolean {
  if (n.type !== 'message' || !n.link || !conversationId) return false;
  const path = n.link.split('?')[0]?.replace(/\/$/, '') ?? '';
  return path === `/chat/${conversationId}`;
}

export function markChatMessageNotificationsReadInList<
  T extends Pick<AppNotification, 'read' | 'type'> & Partial<Pick<AppNotification, 'link' | 'type'>>,
>(list: T[], conversationId: string): T[] {
  return list.map((n) =>
    !n.read && isMessageNotificationForChat(n, conversationId) ? { ...n, read: true } : n,
  );
}

/**
 * Строго по времени: новые сверху.
 * Tie-break по id — стабильный порядок при одинаковом createdAt.
 */
export function sortNotificationsChronologically<
  T extends Pick<AppNotification, 'id' | 'createdAt'>,
>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const byTime = b.createdAt.localeCompare(a.createdAt);
    if (byTime !== 0) return byTime;
    return b.id.localeCompare(a.id);
  });
}
