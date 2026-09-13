import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/stores/authStore';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { PUSH_NOTIFICATIONS_LABEL } from '@/services/notifications/constants';
import { useWebPush } from '@/hooks/useWebPush';
import { useThemePreference } from '@/hooks/useThemePreference';
import { THEME_OPTIONS } from '@/services/theme/constants';
import { api } from '@/services/api';
import type { NotificationPreferences } from '@/types';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Skeleton } from '@/components/ui/Skeleton';
import { Toggle } from '@/components/ui/Toggle';

export default function SystemSettingsPage() {
  const user = useCurrentUser()!;
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const { preference: themePreference, setPreference: setThemePreference } = useThemePreference();
  const prefsKey = ['notification-preferences', user.id] as const;
  /** Serializes preference writes; never tied to SW subscribe/unsubscribe. */
  const prefsWriteRef = useRef(false);

  const {
    data: preferences,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: prefsKey,
    queryFn: () => api.notifications.getPreferences(user.id),
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: (pushEnabled: boolean) => api.notifications.updatePreferences(user.id, { pushEnabled }),
    onMutate: async (pushEnabled) => {
      await queryClient.cancelQueries({ queryKey: prefsKey });
      const previous = queryClient.getQueryData<NotificationPreferences>(prefsKey);
      if (previous) {
        queryClient.setQueryData<NotificationPreferences>(prefsKey, { ...previous, pushEnabled });
      }
      return { previous };
    },
    onSuccess: (data) => {
      // Server response only — no invalidate (avoids stale refetch overwriting ON after OFF).
      queryClient.setQueryData(prefsKey, data);
    },
    onError: (_err, _pushEnabled, context) => {
      if (context?.previous) {
        queryClient.setQueryData(prefsKey, context.previous);
      }
    },
  });

  const { state: webPushState, error: webPushError, enablePush, disablePush } = useWebPush({
    userId: user.id,
    pushEnabled: preferences?.pushEnabled,
    isOnline,
  });

  // Never disable for webPushBusy — SW/API can hang; F5 was the only recovery.
  const toggleDisabled = !isOnline || updatePreferencesMutation.isPending;
  const prefsError =
    updatePreferencesMutation.error instanceof Error
      ? updatePreferencesMutation.error.message
      : updatePreferencesMutation.isError
        ? 'Не удалось сохранить настройку'
        : null;

  const handlePushToggle = async (checked: boolean) => {
    if (!isOnline || prefsWriteRef.current || updatePreferencesMutation.isPending) return;

    prefsWriteRef.current = true;
    try {
      await updatePreferencesMutation.mutateAsync(checked);
      // Subscription side-effects must not block or roll back the preference toggle.
      if (checked) {
        void enablePush();
      } else {
        void disablePush();
      }
    } catch {
      /* onError restores cache */
    } finally {
      prefsWriteRef.current = false;
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-label">Оформление</h2>
        <Card className="space-y-3">
          <p className="text-body-sm text-text-secondary">Тема интерфейса</p>
          <SegmentedControl
            aria-label="Тема интерфейса"
            size="sm"
            value={themePreference}
            options={THEME_OPTIONS}
            onChange={setThemePreference}
          />
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-label">Push-уведомления</h2>
        {!isOnline && (
          <p role="alert" className="mb-3 text-body-sm text-warning">
            {OFFLINE_NETWORK_MESSAGE}
          </p>
        )}
        {error ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isLoading ? (
          <Skeleton className="h-12" />
        ) : preferences ? (
          <Card className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-body-sm">{PUSH_NOTIFICATIONS_LABEL}</p>
              {webPushState.supported && !webPushState.configured && (
                <p className="mt-1 text-caption text-text-muted">Push пока не настроен на сервере.</p>
              )}
              {(webPushError || prefsError) && (
                <p role="alert" className="mt-1 text-caption text-warning">
                  {webPushError ?? prefsError}
                </p>
              )}
            </div>
            <Toggle
              label={PUSH_NOTIFICATIONS_LABEL}
              checked={preferences.pushEnabled}
              disabled={toggleDisabled}
              onChange={(checked) => {
                void handlePushToggle(checked);
              }}
            />
          </Card>
        ) : null}
      </section>
    </div>
  );
}
