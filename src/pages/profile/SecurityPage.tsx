import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  KeyRound,
  Laptop,
  LogOut,
  MonitorSmartphone,
  History,
} from 'lucide-react';
import { useAuthStore, useCurrentUser } from '@/stores/authStore';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { can } from '@/permissions';
import { validateChangePasswordInput } from '@/services/security/validation';
import { LOGIN_HISTORY_UI_LIMIT } from '@/services/security/constants';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';

function StatCard({ label, value, loading }: { label: string; value: string | number; loading?: boolean }) {
  if (loading) return <Skeleton className="h-20 rounded-xl" />;
  return (
    <Card className="p-4">
      <p className="text-caption text-text-muted">{label}</p>
      <p className="mt-1 text-h2">{value}</p>
    </Card>
  );
}

function formatLastLogin(value?: string): string {
  if (!value) return '—';
  return format(new Date(value), 'd MMM, HH:mm', { locale: ru });
}

export default function SecurityPage() {
  const user = useCurrentUser()!;
  const token = useAuthStore((s) => s.session?.token);
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const enabled = can(user, 'security:view-own');

  const {
    data: overview,
    isLoading: overviewLoading,
    error: overviewError,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: ['security', 'overview', user.id],
    queryFn: () => api.security.getOverview(user.id),
    enabled,
  });

  const {
    data: sessions,
    isLoading: sessionsLoading,
    error: sessionsError,
    refetch: refetchSessions,
  } = useQuery({
    queryKey: ['security', 'sessions', user.id, token],
    queryFn: () => api.security.getSessions(user.id, token),
    enabled: enabled && can(user, 'security:manage-sessions'),
  });

  const {
    data: loginHistory,
    isLoading: historyLoading,
    error: historyError,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ['security', 'history', user.id],
    queryFn: () => api.security.getLoginHistory(user.id),
    enabled,
  });

  const invalidateSecurity = () => {
    void queryClient.invalidateQueries({ queryKey: ['security'] });
  };

  const changePasswordMutation = useMutation({
    mutationFn: () =>
      api.security.changePassword(user.id, {
        currentPassword,
        newPassword,
      }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
      invalidateSecurity();
    },
    onError: (error) => {
      setPasswordError(error instanceof ApiError ? error.message : 'Не удалось сменить пароль');
    },
  });

  const revokeSessionMutation = useMutation({
    mutationFn: (sessionId: string) => api.security.revokeSession(sessionId, user.id, token),
    onSuccess: invalidateSecurity,
  });

  const revokeOthersMutation = useMutation({
    mutationFn: () => api.security.revokeAllOtherSessions(user.id, token!),
    onSuccess: invalidateSecurity,
  });

  const handleChangePassword = () => {
    if (!isOnline) return;
    const validationError = validateChangePasswordInput({
      currentPassword,
      newPassword,
      confirmPassword,
    });
    if (validationError) {
      setPasswordError(validationError);
      return;
    }
    setPasswordError('');
    changePasswordMutation.mutate();
  };

  return (
    <div>
      <p className="mb-6 text-body-sm text-text-secondary">
        Пароль, активные сессии и история входов
      </p>

      {overviewError ? (
        <ErrorState message="Не удалось загрузить обзор" onRetry={() => refetchOverview()} className="mb-6" />
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-3">
          <StatCard label="Активные сессии" value={overview?.activeSessions ?? 0} loading={overviewLoading} />
          <StatCard
            label="Последний вход"
            value={formatLastLogin(overview?.lastLoginAt)}
            loading={overviewLoading}
          />
        </div>
      )}

      <section className="mb-6">
        <h2 className="mb-3 flex items-center gap-2 text-label">
          <KeyRound className="h-4 w-4" aria-hidden />
          Смена пароля
        </h2>
        <Card className="space-y-3">
          {!isOnline && (
            <p className="text-body-sm text-warning" role="status">
              {OFFLINE_NETWORK_MESSAGE}
            </p>
          )}
          <Input
            type="password"
            label="Текущий пароль"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            disabled={!isOnline}
          />
          <Input
            type="password"
            label="Новый пароль"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            disabled={!isOnline}
          />
          <Input
            type="password"
            label="Подтверждение"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            disabled={!isOnline}
          />
          {passwordError && (
            <p className="text-body-sm text-danger" role="alert">
              {passwordError}
            </p>
          )}
          <Button
            className="w-full"
            onClick={handleChangePassword}
            disabled={!isOnline || changePasswordMutation.isPending}
          >
            {changePasswordMutation.isPending ? 'Сохранение…' : 'Обновить пароль'}
          </Button>
        </Card>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 flex items-center gap-2 text-label">
          <MonitorSmartphone className="h-4 w-4" aria-hidden />
          Активные сессии
        </h2>
        {sessionsError ? (
          <ErrorState message="Не удалось загрузить сессии" onRetry={() => refetchSessions()} />
        ) : sessionsLoading ? (
          <Skeleton className="h-32 rounded-xl" />
        ) : !sessions?.length ? (
          <EmptyState title="Нет активных сессий" className="py-8" />
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="divide-y divide-border-subtle">
              {sessions.map((session) => (
                <div key={session.id} className="flex items-start gap-3 px-4 py-3">
                  <Laptop className="mt-0.5 h-5 w-5 shrink-0 text-text-muted" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {session.deviceLabel}
                      {session.isCurrent && (
                        <span className="ml-2 text-caption text-brand">Текущая</span>
                      )}
                    </p>
                    <p className="text-caption text-text-muted">
                      {session.ipAddress} · {format(new Date(session.lastActiveAt), 'd MMM, HH:mm', { locale: ru })}
                    </p>
                  </div>
                  {!session.isCurrent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revokeSessionMutation.mutate(session.id)}
                      disabled={!isOnline || revokeSessionMutation.isPending}
                    >
                      Завершить
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {(sessions?.length ?? 0) > 1 && (
              <div className="border-t border-border-subtle p-4">
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => revokeOthersMutation.mutate()}
                  disabled={!isOnline || revokeOthersMutation.isPending || !token}
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  Закрыть все сессии
                </Button>
              </div>
            )}
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-label">
          <History className="h-4 w-4" aria-hidden />
          История входов
        </h2>
        {historyError ? (
          <ErrorState message="Не удалось загрузить историю" onRetry={() => refetchHistory()} />
        ) : historyLoading ? (
          <Skeleton className="h-24 rounded-xl" />
        ) : !loginHistory?.length ? (
          <EmptyState title="История пуста" className="py-8" />
        ) : (
          <Card className="divide-y divide-border-subtle p-0 overflow-hidden">
            {loginHistory.slice(0, LOGIN_HISTORY_UI_LIMIT).map((entry) => (
              <div key={entry.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{entry.deviceLabel}</p>
                  <span
                    className={`text-caption ${entry.success ? 'text-success' : 'text-danger'}`}
                  >
                    {entry.success ? 'Успешно' : 'Отклонено'}
                  </span>
                </div>
                <p className="text-caption text-text-muted">
                  {entry.ipAddress} · {format(new Date(entry.createdAt), 'd MMM yyyy, HH:mm', { locale: ru })}
                </p>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
