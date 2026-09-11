import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { AppNotification } from '@/types';
import { markPassiveNotificationsReadInList } from '@/services/notifications/helpers';

/**
 * На /notifications: непрочитанные остаются выделенными.
 * При уходе (смена маршрута / скрытие вкладки / pagehide) — пассивные → read;
 * urgent (требуют действия) не трогаем.
 *
 * Смена маршрута, а не unmount — чтобы React Strict Mode не сбрасывал прочтение.
 */
export function useMarkPassiveNotificationsOnLeave(userId: string) {
  const queryClient = useQueryClient();
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);
  const flushingRef = useRef(false);

  const flushPassiveRead = () => {
    if (flushingRef.current) return;
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

    const leftNotifications =
      prev.startsWith('/notifications') && !location.pathname.startsWith('/notifications');

    if (leftNotifications) {
      flushRef.current();
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!location.pathname.startsWith('/notifications')) return;

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
  }, [location.pathname]);
}
