import { describe, it, expect, beforeEach } from 'vitest';
import { can } from '@/permissions';
import {
  canChangePassword,
  canManageSessions,
  canViewSecurity,
} from '@/services/security/access';
import {
  countUnreadAlerts,
  getLastSuccessfulLogin,
  sortLoginHistoryByDate,
} from '@/services/security/helpers';
import { validateChangePasswordInput } from '@/services/security/validation';
import { createMockSecurityApi, buildPasswordMap } from '@/services/api/mock/security';
import {
  initialLoginHistory,
  initialSecurityAlerts,
  initialSecuritySessions,
  users,
} from '@/mocks/seed';
import type { AuthSession } from '@/types';
import { ApiError } from '@/services/api/types';

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

  it('counts unread alerts', () => {
    expect(countUnreadAlerts(initialSecurityAlerts.filter((a) => a.userId === student.id))).toBe(1);
  });

  it('returns last successful login', () => {
    const last = getLastSuccessfulLogin(initialLoginHistory.filter((h) => h.userId === student.id));
    expect(last).toBeDefined();
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
    expect(overview.unreadAlerts).toBe(1);
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

  it('marks alert as read', async () => {
    await api.markAlertRead('sec-alert-1', student.id);
    const alerts = await api.getSecurityAlerts(student.id);
    expect(alerts.find((a) => a.id === 'sec-alert-1')?.read).toBe(true);
  });
});
