import { useEffect, useRef } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { AppNotification } from '@/types';
import { eventIdFromNotificationLink } from '@/services/events/unread';

/** Пометить unread event-уведомления по `/events/:id` как прочитанные. */
export async function markEventNotificationsRead(
  eventId: string,
  userId: string,
  queryClient: QueryClient,
): Promise<void> {
  const key = ['notifications', userId] as const;
  let list = queryClient.getQueryData<AppNotification[]>(key);
  if (!list) {
    list = await api.notifications.getNotifications(userId);
    queryClient.setQueryData(key, list);
  }

  const targets = list.filter(
    (n) =>
      !n.read &&
      n.type === 'event' &&
      eventIdFromNotificationLink(n.link) === eventId,
  );
  if (targets.length === 0) return;

  const targetIds = new Set(targets.map((t) => t.id));
  queryClient.setQueryData<AppNotification[]>(key, (old) =>
    old?.map((n) => (targetIds.has(n.id) ? { ...n, read: true } : n)),
  );

  await Promise.all(targets.map((n) => api.notifications.markAsRead(n.id, userId)));
  void queryClient.invalidateQueries({ queryKey: key });
}

/**
 * Авто-read при открытии деталки (ученик: новое мероприятие).
 * Staff — нет: бейдж на иконке «Участники» до открытия списка.
 */
export function useMarkEventParticipationViewed(
  eventId: string | undefined,
  userId: string | undefined,
  enabled: boolean,
) {
  const queryClient = useQueryClient();
  const markedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !eventId || !userId) return;
    if (markedRef.current === eventId) return;

    let cancelled = false;

    void (async () => {
      await markEventNotificationsRead(eventId, userId, queryClient);
      if (cancelled) return;
      markedRef.current = eventId;
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId, userId, enabled, queryClient]);
}
