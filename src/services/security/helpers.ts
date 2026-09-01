import type { LoginHistoryEntry, SecurityAlert } from '@/types';

export const SECURITY_ALERT_LABELS: Record<
  import('@/types').SecurityAlertType,
  string
> = {
  new_device: 'Новое устройство',
  password_changed: 'Смена пароля',
  failed_login: 'Неудачный вход',
  session_revoked: 'Завершение сессии',
};

export function sortLoginHistoryByDate(entries: LoginHistoryEntry[]): LoginHistoryEntry[] {
  return [...entries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function countUnreadAlerts(alerts: SecurityAlert[]): number {
  return alerts.filter((alert) => !alert.read).length;
}

export function getLastSuccessfulLogin(entries: LoginHistoryEntry[]): string | undefined {
  const success = sortLoginHistoryByDate(entries).find((entry) => entry.success);
  return success?.createdAt;
}
