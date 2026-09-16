import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { warmAppCache } from '@/services/cache/warmAppCache';
import type { User } from '@/types';

/**
 * After auth, idle-prefetch main tabs + recent chat threads so cold start
 * feels instant when navigating (Home / Lessons / Chat / Events / Assignments).
 */
export function useWarmAppCache(user: User | undefined | null) {
  const queryClient = useQueryClient();
  const warmedForUser = useRef<string | null>(null);
  const userId = user?.id;
  const role = user?.role;

  useEffect(() => {
    if (!userId || !role) {
      warmedForUser.current = null;
      return;
    }
    if (warmedForUser.current === userId) return;
    warmedForUser.current = userId;

    let cancelled = false;
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const run = () => {
      if (cancelled) return;
      void warmAppCache(queryClient, { id: userId, role });
    };

    const ric = window.requestIdleCallback?.bind(window);
    if (ric) {
      idleId = ric(run, { timeout: 1500 });
    } else {
      timeoutId = setTimeout(run, 120);
    }

    return () => {
      cancelled = true;
      if (idleId != null) window.cancelIdleCallback?.(idleId);
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, [userId, role, queryClient]);
}
