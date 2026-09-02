import { useEffect } from 'react';
import { getPocketBase, isPocketBaseMode } from '@/services/api/pocketbase/client';
import { useAuthStore } from '@/stores/authStore';

/**
 * Keeps Zustand session in sync with PocketBase when profile/role changes server-side.
 * Subscribes to the current user record + refreshes on window focus.
 */
export function useAuthSessionSync(userId: string | undefined): void {
  const syncSession = useAuthStore((s) => s.syncSession);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (!userId || !isPocketBaseMode()) return;

    const pb = getPocketBase();
    let unsubscribe: (() => Promise<void>) | null = null;
    let cancelled = false;

    void pb
      .collection('users')
      .subscribe(userId, (event) => {
        if (event.action === 'update') {
          void syncSession();
        }
        if (event.action === 'delete') {
          void logout();
        }
      })
      .then((unsub) => {
        if (cancelled) {
          void unsub();
        } else {
          unsubscribe = unsub;
        }
      })
      .catch(() => {});

    const onFocus = () => {
      void syncSession();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      if (unsubscribe) void unsubscribe();
      window.removeEventListener('focus', onFocus);
    };
  }, [userId, syncSession, logout]);
}
