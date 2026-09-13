import { useEffect, useRef } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { AppNotification } from '@/types';
import {
  assignmentIdFromNotificationLink,
  markAssignmentViewedLocal,
} from '@/services/assignments/unread';

/** Пометить unread assignment-уведомления как прочитанные (best-effort). */
export async function markAssignmentNotificationsRead(
  assignmentId: string,
  userId: string,
  queryClient: QueryClient,
): Promise<void> {
  markAssignmentViewedLocal(userId, assignmentId);

  const key = ['notifications', userId] as const;
  // Триггер пересчёта бейджа в AppLayout (localStorage + тот же query).
  queryClient.setQueryData<AppNotification[]>(key, (old) => (old ? [...old] : old));
  void queryClient.invalidateQueries({ queryKey: ['assignments'] });

  let list = queryClient.getQueryData<AppNotification[]>(key);
  if (!list) {
    try {
      list = await api.notifications.getNotifications(userId);
      queryClient.setQueryData(key, list);
    } catch {
      return;
    }
  }

  const targets = list.filter((n) => {
    if (n.read) return false;
    if (n.type && n.type !== 'assignment') return false;
    const linkedId = assignmentIdFromNotificationLink(n.link);
    if (linkedId === assignmentId) return true;
    // fallback: body = title — без id в link всё равно гасим notif при открытии любого?
    // только точное совпадение link/id
    return false;
  });

  if (targets.length === 0) return;

  const targetIds = new Set(targets.map((t) => t.id));
  queryClient.setQueryData<AppNotification[]>(key, (old) =>
    old?.map((n) => (targetIds.has(n.id) ? { ...n, read: true } : n)) ?? old,
  );

  await Promise.all(
    targets.map((n) =>
      api.notifications.markAsRead(n.id, userId).catch(() => {
        /* local viewed already cleared badge */
      }),
    ),
  );

  void queryClient.invalidateQueries({ queryKey: key });
}

export function useMarkAssignmentViewed(
  assignmentId: string | undefined,
  userId: string | undefined,
) {
  const queryClient = useQueryClient();
  const markedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!assignmentId || !userId) return;
    if (markedRef.current === assignmentId) return;

    markAssignmentViewedLocal(userId, assignmentId);
    queryClient.setQueryData<AppNotification[]>(['notifications', userId], (old) =>
      old ? [...old] : old,
    );
    void queryClient.invalidateQueries({ queryKey: ['assignments'] });
    markedRef.current = assignmentId;

    let cancelled = false;
    void (async () => {
      await markAssignmentNotificationsRead(assignmentId, userId, queryClient);
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
  }, [assignmentId, userId, queryClient]);
}
