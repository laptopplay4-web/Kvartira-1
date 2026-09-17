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
    try {
      list = await api.notifications.getNotifications(userId);
      queryClient.setQueryData(key, list);
    } catch {
      return;
    }
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
    old?.map((n) => (targetIds.has(n.id) ? { ...n, read: true } : n)) ?? old,
  );

  await Promise.all(
    targets.map((n) =>
      api.notifications.markAsRead(n.id, userId).catch(() => {
        /* optimistic cache already cleared card +N / delta */
      }),
    ),
  );

  void queryClient.invalidateQueries({ queryKey: key });
}

/**
 * Авто-read при открытии деталки (ученик: новое мероприятие → снимает +N на карточке).
 * Staff — нет: бейдж участников до закрытия списка участников.
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
    markedRef.current = eventId;

    let cancelled = false;

    void (async () => {
      await markEventNotificationsRead(eventId, userId, queryClient);
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId, userId, enabled, queryClient]);
}
