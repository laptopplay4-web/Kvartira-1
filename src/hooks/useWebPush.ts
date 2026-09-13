import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/services/api';
import {
  getActivePushSubscription,
  getWebPushClientState,
  isWebPushConfigured,
  isWebPushSupported,
  subscribeToWebPush,
  subscriptionToInput,
  unsubscribeFromWebPush,
  type EnablePushResult,
} from '@/services/push/helpers';
import {
  PUSH_NOT_CONFIGURED_MESSAGE,
  PUSH_PERMISSION_DENIED_MESSAGE,
  PUSH_SW_UNAVAILABLE_MESSAGE,
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
  /** Bumps on each enable/disable so a slow unsubscribe cannot undo a newer subscribe. */
  const opGenRef = useRef(0);

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

  const enablePush = useCallback(async (): Promise<EnablePushResult> => {
    const gen = ++opGenRef.current;
    setError(null);

    if (!userId || !isOnline) {
      return { status: 'failed', message: 'Нет подключения' };
    }

    if (!isWebPushSupported()) {
      setError(PUSH_UNSUPPORTED_MESSAGE);
      return { status: 'unavailable', message: PUSH_UNSUPPORTED_MESSAGE };
    }

    if (!isWebPushConfigured()) {
      setError(PUSH_NOT_CONFIGURED_MESSAGE);
      return { status: 'unavailable', message: PUSH_NOT_CONFIGURED_MESSAGE };
    }

    setBusy(true);
    try {
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      if (gen !== opGenRef.current) {
        return { status: 'unavailable', message: 'superseded' };
      }

      if (permission !== 'granted') {
        setError(PUSH_PERMISSION_DENIED_MESSAGE);
        await refreshState();
        return { status: 'failed', message: PUSH_PERMISSION_DENIED_MESSAGE };
      }

      const subscription = await subscribeToWebPush();
      if (gen !== opGenRef.current) {
        return { status: 'unavailable', message: 'superseded' };
      }

      await api.notifications.registerPushSubscription(userId, subscriptionToInput(subscription));
      if (gen !== opGenRef.current) {
        return { status: 'unavailable', message: 'superseded' };
      }

      await refreshState();
      return { status: 'subscribed' };
    } catch (e) {
      if (gen !== opGenRef.current) {
        return { status: 'unavailable', message: 'superseded' };
      }
      const isSw = e instanceof Error && e.message.includes('Service Worker');
      const message = isSw
        ? PUSH_SW_UNAVAILABLE_MESSAGE
        : e instanceof Error
          ? e.message
          : 'Не удалось включить push';
      setError(message);
      await refreshState();
      return { status: isSw ? 'unavailable' : 'failed', message };
    } finally {
      if (gen === opGenRef.current) {
        setBusy(false);
      }
    }
  }, [userId, isOnline, refreshState]);

  const disablePush = useCallback(async (): Promise<void> => {
    if (!userId) return;

    const gen = ++opGenRef.current;
    setBusy(true);
    setError(null);
    try {
      const subscription = await getActivePushSubscription();
      if (gen !== opGenRef.current) return;

      await unsubscribeFromWebPush();
      if (gen !== opGenRef.current) return;

      await api.notifications.unregisterPushSubscription(userId, subscription?.endpoint);
      if (gen !== opGenRef.current) return;

      await refreshState();
    } catch (e) {
      if (gen !== opGenRef.current) return;
      setError(e instanceof Error ? e.message : 'Не удалось отключить push');
    } finally {
      if (gen === opGenRef.current) {
        setBusy(false);
      }
    }
  }, [userId, refreshState]);

  /** Re-sync on load when preference is on (not while a user op is in flight). */
  useEffect(() => {
    if (!userId || !pushEnabled || !isOnline || busy) return;
    if (!isWebPushSupported() || !isWebPushConfigured()) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    const genAtStart = opGenRef.current;
    let cancelled = false;
    void (async () => {
      try {
        const subscription = await getActivePushSubscription();
        if (cancelled || genAtStart !== opGenRef.current) return;
        if (!subscription) {
          const created = await subscribeToWebPush();
          if (cancelled || genAtStart !== opGenRef.current) return;
          await api.notifications.registerPushSubscription(userId, subscriptionToInput(created));
        } else {
          await api.notifications.registerPushSubscription(userId, subscriptionToInput(subscription));
        }
        if (!cancelled && genAtStart === opGenRef.current) await refreshState();
      } catch {
        /* best-effort */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, pushEnabled, isOnline, busy, refreshState]);

  return {
    state,
    error,
    busy,
    enablePush,
    disablePush,
    refreshState,
  };
}
