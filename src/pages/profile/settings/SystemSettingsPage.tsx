import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/stores/authStore';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { PUSH_NOTIFICATIONS_HINT, PUSH_NOTIFICATIONS_LABEL } from '@/services/notifications/constants';
import { useWebPush } from '@/hooks/useWebPush';
import { useThemePreference } from '@/hooks/useThemePreference';
import { THEME_OPTIONS } from '@/services/theme/constants';
import { api } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Toggle } from '@/components/ui/Toggle';

export default function SystemSettingsPage() {
  const user = useCurrentUser()!;
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const { preference: themePreference, setPreference: setThemePreference } = useThemePreference();

  const {
    data: preferences,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['notification-preferences', user.id],
    queryFn: () => api.notifications.getPreferences(user.id),
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: (pushEnabled: boolean) => api.notifications.updatePreferences(user.id, { pushEnabled }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notification-preferences', user.id] });
    },
  });

  const { state: webPushState, error: webPushError, busy: webPushBusy, enablePush, disablePush } = useWebPush({
    userId: user.id,
    pushEnabled: preferences?.pushEnabled,
    isOnline,
  });

  const toggleDisabled = !isOnline || updatePreferencesMutation.isPending || webPushBusy;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-label">Оформление</h2>
        <Card className="space-y-3">
          <p className="text-body-sm text-text-secondary">Тема интерфейса</p>
          <div className="flex flex-wrap gap-2">
            {THEME_OPTIONS.map(({ value, label }) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={themePreference === value ? 'primary' : 'secondary'}
                onClick={() => setThemePreference(value)}
                aria-pressed={themePreference === value}
              >
                {label}
              </Button>
            ))}
          </div>
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
              <p className="text-caption text-text-muted">{PUSH_NOTIFICATIONS_HINT}</p>
              {webPushState.supported && !webPushState.configured && (
                <p className="mt-1 text-caption text-text-muted">Push пока не настроен на сервере.</p>
              )}
              {webPushError && (
                <p role="alert" className="mt-1 text-caption text-warning">
                  {webPushError}
                </p>
              )}
            </div>
            <Toggle
              label={PUSH_NOTIFICATIONS_LABEL}
              checked={preferences.pushEnabled}
              disabled={toggleDisabled}
              onChange={async (checked) => {
                if (!isOnline) return;
                if (checked) {
                  const ok = await enablePush();
                  if (!ok) return;
                  updatePreferencesMutation.mutate(true);
                  return;
                }
                updatePreferencesMutation.mutate(false);
                await disablePush();
              }}
            />
          </Card>
        ) : null}
      </section>
    </div>
  );
}
