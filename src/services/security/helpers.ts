import type { LoginHistoryEntry, SecurityAlert, SecuritySession } from '@/types';

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

/**
 * Keeps every login session (multi-device) and normalizes exactly one `isCurrent`.
 * Prefer an already flagged current session; if several/none — most recently active.
 */
export function resolveSecuritySessions(sessions: SecuritySession[]): SecuritySession[] {
  if (sessions.length === 0) return [];

  const sorted = [...sessions].sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
  const flaggedCurrent = sorted.filter((session) => session.isCurrent);
  const currentId =
    flaggedCurrent.length === 1
      ? flaggedCurrent[0].id
      : flaggedCurrent.sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt))[0]?.id ??
        sorted[0]?.id;

  return sorted.map((session) => ({
    ...session,
    isCurrent: session.id === currentId,
  }));
}
