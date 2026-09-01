import { useCallback, useEffect, useState } from 'react';
import { api } from '@/services/api';
import {
  getActivePushSubscription,
  getWebPushClientState,
  isWebPushConfigured,
  isWebPushSupported,
  subscribeToWebPush,
  subscriptionToInput,
  unsubscribeFromWebPush,
} from '@/services/push/helpers';
import {
  PUSH_PERMISSION_DENIED_MESSAGE,
  PUSH_UNSUPPORTED_MESSAGE,
} from '@/services/push/constants';
import type { WebPushClientState } from '@/types';

interface UseWebPushOptions {
  userId: string | undefined;
  pushEnabled: boolean | undefined;
  isOnline: boolean;
}

export function useWebPush({ userId, pushEnabled, isOnline }: UseWebPushOptions) {
  const [state, setState] = useState<WebPushClientState>(() => getWebPushClientState());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshState = useCallback(async () => {
    const base = getWebPushClientState();
    if (!base.supported) {
      setState(base);
      return;
    }

    const subscription = await getActivePushSubscription();
    setState({
      ...base,
      subscribed: Boolean(subscription),
    });
  }, []);

  useEffect(() => {
    void refreshState();
  }, [refreshState]);

  const enablePush = useCallback(async (): Promise<boolean> => {
    setError(null);

    if (!userId || !isOnline) return false;

    if (!isWebPushSupported()) {
      setError(PUSH_UNSUPPORTED_MESSAGE);
      return false;
    }

    if (!isWebPushConfigured()) {
      setError(PUSH_UNSUPPORTED_MESSAGE);
      return false;
    }

    setBusy(true);
    try {
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }

      if (permission !== 'granted') {
        setError(PUSH_PERMISSION_DENIED_MESSAGE);
        await refreshState();
        return false;
      }

      const subscription = await subscribeToWebPush();
      await api.notifications.registerPushSubscription(userId, subscriptionToInput(subscription));
      await refreshState();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось включить push');
      await refreshState();
      return false;
    } finally {
      setBusy(false);
    }
  }, [userId, isOnline, refreshState]);

  const disablePush = useCallback(async (): Promise<void> => {
    if (!userId) return;

    setBusy(true);
    setError(null);
    try {
      const subscription = await getActivePushSubscription();
      await unsubscribeFromWebPush();
      await api.notifications.unregisterPushSubscription(
        userId,
        subscription?.endpoint,
      );
      await refreshState();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отключить push');
    } finally {
      setBusy(false);
    }
  }, [userId, refreshState]);

  /** Re-sync server subscription when user is logged in with push enabled. */
  useEffect(() => {
    if (!userId || !pushEnabled || !isOnline) return;
    if (!isWebPushSupported() || !isWebPushConfigured()) return;
    if (Notification.permission !== 'granted') return;

    void (async () => {
      try {
        const subscription = await getActivePushSubscription();
        if (!subscription) {
          const created = await subscribeToWebPush();
          await api.notifications.registerPushSubscription(userId, subscriptionToInput(created));
        } else {
          await api.notifications.registerPushSubscription(userId, subscriptionToInput(subscription));
        }
        await refreshState();
      } catch {
        /* best-effort background sync */
      }
    })();
  }, [userId, pushEnabled, isOnline, refreshState]);

  return {
    state,
    error,
    busy,
    enablePush,
    disablePush,
    refreshState,
  };
}
