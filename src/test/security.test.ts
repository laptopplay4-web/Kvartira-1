import { describe, it, expect, beforeEach } from 'vitest';
import { can } from '@/permissions';
import {
  canChangePassword,
  canManageSessions,
  canViewSecurity,
} from '@/services/security/access';
import {
  getLastSuccessfulLogin,
  resolveSecuritySessions,
  sortLoginHistoryByDate,
} from '@/services/security/helpers';
import { validateChangePasswordInput } from '@/services/security/validation';
import { createMockSecurityApi, buildPasswordMap, recordAuthLogin } from '@/services/api/mock/security';
import {
  initialLoginHistory,
  initialSecurityAlerts,
  initialSecuritySessions,
  users,
} from '@/mocks/seed';
import type { AuthSession, AppNotification } from '@/types';

const student = users.find((u) => u.id === 'user-student')!;
const otherStudent = users.find((u) => u.id === 'user-student-2')!;

function createTestDb() {
  return {
    users: [...users],
    passwords: buildPasswordMap(users),
    securitySessions: structuredClone(initialSecuritySessions),
    loginHistory: structuredClone(initialLoginHistory),
    securityAlerts: structuredClone(initialSecurityAlerts),
    sessions: new Map<string, AuthSession>(),
    passwordChangedAt: new Map<string, string>(),
    notifications: [] as AppNotification[],
    notificationPreferences: new Map(),
    pushDeliveries: [],
    pushSubscriptions: [],
  };
}

describe('security access', () => {
  it('user can view own security only', () => {
    expect(canViewSecurity(student, student.id)).toBe(true);
    expect(canViewSecurity(student, otherStudent.id)).toBe(false);
  });

  it('user can change own password and manage sessions', () => {
    expect(canChangePassword(student, student.id)).toBe(true);
    expect(canManageSessions(student, student.id)).toBe(true);
    expect(canChangePassword(student, otherStudent.id)).toBe(false);
  });

  it('all roles have security permissions', () => {
    expect(can(student, 'security:view-own')).toBe(true);
    expect(can({ ...student, role: 'teacher' }, 'security:manage-password')).toBe(true);
    expect(can({ ...student, role: 'admin' }, 'security:manage-sessions')).toBe(true);
  });
});

describe('security helpers', () => {
  it('sorts login history by date desc', () => {
    const sorted = sortLoginHistoryByDate(initialLoginHistory);
    expect(new Date(sorted[0].createdAt).getTime()).toBeGreaterThanOrEqual(
      new Date(sorted[1].createdAt).getTime(),
    );
  });

  it('returns last successful login', () => {
    const last = getLastSuccessfulLogin(initialLoginHistory.filter((h) => h.userId === student.id));
    expect(last).toBeDefined();
  });

  it('resolves a single current session when multiple are flagged', () => {
    const resolved = resolveSecuritySessions([
      {
        id: 'a',
        userId: 'user-student',
        deviceLabel: 'Chrome · Windows',
        platform: 'web',
        ipAddress: '1.1.1.1',
        lastActiveAt: '2026-01-02T10:00:00.000Z',
        createdAt: '2026-01-01T10:00:00.000Z',
        isCurrent: true,
      },
      {
        id: 'b',
        userId: 'user-student',
        deviceLabel: 'Chrome · Windows',
        platform: 'web',
        ipAddress: '1.1.1.2',
        lastActiveAt: '2026-01-03T10:00:00.000Z',
        createdAt: '2026-01-02T10:00:00.000Z',
        isCurrent: true,
      },
      {
        id: 'c',
        userId: 'user-student',
        deviceLabel: 'Safari · iPhone',
        platform: 'ios',
        ipAddress: '1.1.1.3',
        lastActiveAt: '2026-01-01T10:00:00.000Z',
        createdAt: '2026-01-01T10:00:00.000Z',
        isCurrent: true,
      },
    ]);

    expect(resolved).toHaveLength(2);
    expect(resolved.filter((s) => s.isCurrent)).toHaveLength(1);
    expect(resolved.find((s) => s.isCurrent)?.id).toBe('b');
  });
});

describe('security validation', () => {
  it('rejects short password', () => {
    expect(
      validateChangePasswordInput({
        currentPassword: 'old',
        newPassword: 'short',
        confirmPassword: 'short',
      }),
    ).toContain('минимум');
  });

  it('rejects mismatched confirmation', () => {
    expect(
      validateChangePasswordInput({
        currentPassword: 'student123',
        newPassword: 'newpassword1',
        confirmPassword: 'newpassword2',
      }),
    ).toContain('не совпадают');
  });
});

describe('security api', () => {
  let db: ReturnType<typeof createTestDb>;
  let api: ReturnType<typeof createMockSecurityApi>;

  beforeEach(() => {
    db = createTestDb();
    api = createMockSecurityApi(db, async () => {});
  });

  it('returns overview for own user', async () => {
    const overview = await api.getOverview(student.id);
    expect(overview.activeSessions).toBeGreaterThan(0);
    expect(overview.lastLoginAt).toBeDefined();
  });

  it('blocks revoking another user session', async () => {
    await expect(api.revokeSession('sess-1', otherStudent.id, 'token')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('changes password with valid credentials', async () => {
    await api.changePassword(student.id, {
      currentPassword: 'student123',
      newPassword: 'newpassword1',
    });
    expect(db.passwords.get(student.id)).toBe('newpassword1');
    expect(db.passwordChangedAt.get(student.id)).toBeDefined();
  });

  it('rejects wrong current password', async () => {
    await expect(
      api.changePassword(student.id, {
        currentPassword: 'wrong',
        newPassword: 'newpassword1',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('marks current session', async () => {
    const sessions = await api.getSessions(student.id, 'seed-token-student-desktop');
    expect(sessions.find((s) => s.id === 'sess-1')?.isCurrent).toBe(true);
    expect(sessions.find((s) => s.id === 'sess-2')?.isCurrent).toBe(false);
  });

  it('revokes other session', async () => {
    await api.revokeSession('sess-2', student.id, 'seed-token-student-desktop');
    const sessions = await api.getSessions(student.id, 'seed-token-student-desktop');
    expect(sessions.some((s) => s.id === 'sess-2')).toBe(false);
  });

  it('cannot revoke current session', async () => {
    await expect(
      api.revokeSession('sess-1', student.id, 'seed-token-student-desktop'),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('reuses session for same device on login', () => {
    const chromeBefore = db.securitySessions.filter(
      (s) => s.userId === student.id && s.deviceLabel === 'Chrome · Windows',
    );
    recordAuthLogin(db, student.id, 'token-relogin', true, 'Chrome · Windows');
    recordAuthLogin(db, student.id, 'token-relogin-2', true, 'Chrome · Windows');
    const chromeAfter = db.securitySessions.filter(
      (s) => s.userId === student.id && s.deviceLabel === 'Chrome · Windows',
    );
    expect(chromeAfter).toHaveLength(chromeBefore.length);
    expect(chromeAfter[0]?.token).toBe('token-relogin-2');
  });

  it('creates in-app notification on failed login', () => {
    recordAuthLogin(db, student.id, 'token-fail', false);
    expect(db.notifications.some((n) => n.title === 'Неудачная попытка входа')).toBe(true);
  });

  it('creates in-app notification on new session login', () => {
    recordAuthLogin(db, student.id, 'token-new-login', true, 'Safari · iOS');
    expect(db.notifications.some((n) => n.title === 'Вход в аккаунт')).toBe(true);
  });

  it('marks alert as read', async () => {
    await api.markAlertRead('sec-alert-1', student.id);
    const alerts = await api.getSecurityAlerts(student.id);
    expect(alerts.find((a) => a.id === 'sec-alert-1')?.read).toBe(true);
  });
});
