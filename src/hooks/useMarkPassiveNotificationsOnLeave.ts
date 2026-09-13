import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { AppNotification } from '@/types';
import {
  didLeaveNotificationsRoute,
  markPassiveNotificationsReadInList,
} from '@/services/notifications/helpers';

/**
 * Пассивные unread → read при уходе с `/notifications`.
 * Вызывать из AppLayout (остаётся смонтированным при смене маршрута).
 * NotificationsPage при navigate размонтируется — там хук не сработает.
 */
export function useMarkPassiveNotificationsOnLeave(userId: string | undefined) {
  const queryClient = useQueryClient();
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);
  const flushingRef = useRef(false);

  const flushPassiveRead = () => {
    if (!userId || flushingRef.current) return;
    flushingRef.current = true;

    queryClient.setQueryData<AppNotification[]>(['notifications', userId], (old) =>
      old ? markPassiveNotificationsReadInList(old) : old,
    );

    void api.notifications
      .markAllAsRead(userId)
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
      })
      .finally(() => {
        flushingRef.current = false;
      });
  };

  const flushRef = useRef(flushPassiveRead);
  flushRef.current = flushPassiveRead;

  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = location.pathname;

    if (didLeaveNotificationsRoute(prev, location.pathname)) {
      flushRef.current();
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!userId || !location.pathname.startsWith('/notifications')) return;

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flushRef.current();
      }
    };

    const onPageHide = () => {
      flushRef.current();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [location.pathname, userId]);
}
