import type {
  AuthSession,
  LoginHistoryEntry,
  SecurityAlert,
  SecuritySession,
  SecurityOverview,
  User,
} from '@/types';
import {
  DEMO_ACCOUNTS,
  type SecuritySessionRecord,
} from '@/mocks/seed';
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
import { MAX_LOGIN_HISTORY_ENTRIES, MIN_PASSWORD_LENGTH } from '@/services/security/constants';
import { ApiError } from '@/services/api/types';
import type { ChangePasswordInput, SecurityApi } from '@/services/api/types';
import { tryPushNotification, type MockNotificationsDb } from './notifications';

const SECURITY_SETTINGS_LINK = '/profile/settings/security';

export interface MockSecurityDb extends MockNotificationsDb {
  users: User[];
  passwords: Map<string, string>;
  securitySessions: SecuritySessionRecord[];
  loginHistory: LoginHistoryEntry[];
  securityAlerts: SecurityAlert[];
  sessions: Map<string, AuthSession>;
  passwordChangedAt: Map<string, string>;
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getUserById(db: MockSecurityDb, userId: string): User {
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new ApiError('Пользователь не найден', 'NOT_FOUND', 404);
  return user;
}

function assertViewAccess(db: MockSecurityDb, userId: string, requesterId: string): User {
  const user = getUserById(db, requesterId);
  if (!canViewSecurity(user, userId)) {
    throw new ApiError('Нет доступа к настройкам безопасности', 'FORBIDDEN', 403);
  }
  return user;
}

function getPasswordForUser(db: MockSecurityDb, user: User): string {
  return db.passwords.get(user.id) ?? 'password';
}

export function pushAlert(
  db: MockSecurityDb,
  userId: string,
  type: SecurityAlert['type'],
  title: string,
  message: string,
) {
  db.securityAlerts.unshift({
    id: uid('sec-alert'),
    userId,
    type,
    title,
    message,
    read: false,
    createdAt: new Date().toISOString(),
  });
}

function pushSecurityNotification(
  db: MockSecurityDb,
  userId: string,
  title: string,
  body: string,
  link = SECURITY_SETTINGS_LINK,
) {
  tryPushNotification(db, userId, 'system', title, body, link);
}

function toPublicSession(
  record: SecuritySessionRecord,
  currentToken?: string,
): SecuritySession {
  return {
    id: record.id,
    userId: record.userId,
    deviceLabel: record.deviceLabel,
    platform: record.platform,
    ipAddress: record.ipAddress,
    lastActiveAt: record.lastActiveAt,
    createdAt: record.createdAt,
    isCurrent: currentToken ? record.token === currentToken : false,
  };
}

export function buildPasswordMap(users: User[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const user of users) {
    if (user.phone === DEMO_ACCOUNTS.student.phone) {
      map.set(user.id, DEMO_ACCOUNTS.student.password);
    } else if (user.phone === DEMO_ACCOUNTS.teacher.phone) {
      map.set(user.id, DEMO_ACCOUNTS.teacher.password);
    } else if (user.phone === DEMO_ACCOUNTS.admin.phone) {
      map.set(user.id, DEMO_ACCOUNTS.admin.password);
    } else {
      map.set(user.id, 'password');
    }
  }
  return map;
}

export function recordAuthLogin(
  db: MockSecurityDb,
  userId: string,
  token: string,
  success: boolean,
  deviceLabel = 'Chrome · Windows',
  ipAddress = '192.168.1.10',
) {
  db.loginHistory.unshift({
    id: uid('login'),
    userId,
    deviceLabel,
    ipAddress,
    success,
    createdAt: new Date().toISOString(),
  });
  if (db.loginHistory.length > MAX_LOGIN_HISTORY_ENTRIES) {
    db.loginHistory.length = MAX_LOGIN_HISTORY_ENTRIES;
  }

  if (!success) {
    pushSecurityNotification(
      db,
      userId,
      'Неудачная попытка входа',
      'Кто-то пытался войти в аккаунт с неверным паролем.',
    );
    return;
  }

  const existingByDevice = db.securitySessions.find(
    (s) => s.userId === userId && s.deviceLabel === deviceLabel,
  );
  if (existingByDevice) {
    existingByDevice.token = token;
    existingByDevice.lastActiveAt = new Date().toISOString();
    existingByDevice.ipAddress = ipAddress;
    return;
  }

  const existing = db.securitySessions.find((s) => s.token === token);
  if (!existing) {
    db.securitySessions.push({
      id: uid('sess'),
      userId,
      token,
      deviceLabel,
      platform: 'web',
      ipAddress,
      lastActiveAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
    pushSecurityNotification(
      db,
      userId,
      'Вход в аккаунт',
      `Обнаружен вход с ${deviceLabel}.`,
    );
  } else {
    existing.lastActiveAt = new Date().toISOString();
  }
}

export function createMockSecurityApi(
  db: MockSecurityDb,
  delay: (ms?: number) => Promise<void>,
): SecurityApi {
  return {
    async getOverview(requesterId) {
      await delay();
      assertViewAccess(db, requesterId, requesterId);
      const sessions = resolveSecuritySessions(
        db.securitySessions
          .filter((s) => s.userId === requesterId)
          .map((s) => toPublicSession(s)),
      );
      const history = db.loginHistory.filter((h) => h.userId === requesterId);
      const overview: SecurityOverview = {
        activeSessions: sessions.length,
        lastLoginAt: getLastSuccessfulLogin(history),
        passwordChangedAt: db.passwordChangedAt.get(requesterId),
      };
      return overview;
    },

    async changePassword(requesterId, input: ChangePasswordInput) {
      await delay();
      const user = getUserById(db, requesterId);
      if (!canChangePassword(user, requesterId)) {
        throw new ApiError('Нет доступа к смене пароля', 'FORBIDDEN', 403);
      }
      if (input.newPassword.length < MIN_PASSWORD_LENGTH) {
        throw new ApiError(
          `Пароль должен содержать минимум ${MIN_PASSWORD_LENGTH} символов`,
          'VALIDATION',
          400,
        );
      }
      if (getPasswordForUser(db, user) !== input.currentPassword) {
        throw new ApiError('Неверный текущий пароль', 'INVALID_CREDENTIALS', 401);
      }
      if (input.currentPassword === input.newPassword) {
        throw new ApiError('Новый пароль должен отличаться от текущего', 'VALIDATION', 400);
      }

      db.passwords.set(requesterId, input.newPassword);
      const changedAt = new Date().toISOString();
      db.passwordChangedAt.set(requesterId, changedAt);
      pushSecurityNotification(
        db,
        requesterId,
        'Пароль изменён',
        'Пароль вашего аккаунта был успешно обновлён.',
      );
    },

    async getSessions(requesterId, currentToken) {
      await delay();
      assertViewAccess(db, requesterId, requesterId);
      return resolveSecuritySessions(
        db.securitySessions
          .filter((s) => s.userId === requesterId)
          .map((s) => toPublicSession(s, currentToken)),
      );
    },

    async revokeSession(sessionId, requesterId, currentToken) {
      await delay();
      const user = getUserById(db, requesterId);
      if (!canManageSessions(user, requesterId)) {
        throw new ApiError('Нет доступа к управлению сессиями', 'FORBIDDEN', 403);
      }
      const session = db.securitySessions.find((s) => s.id === sessionId && s.userId === requesterId);
      if (!session) throw new ApiError('Сессия не найдена', 'NOT_FOUND', 404);
      if (currentToken && session.token === currentToken) {
        throw new ApiError('Нельзя завершить текущую сессию', 'VALIDATION', 400);
      }

      db.securitySessions = db.securitySessions.filter((s) => s.id !== sessionId);
      db.sessions.delete(session.token);
    },

    async revokeAllOtherSessions(requesterId, currentToken) {
      await delay();
      const user = getUserById(db, requesterId);
      if (!canManageSessions(user, requesterId)) {
        throw new ApiError('Нет доступа к управлению сессиями', 'FORBIDDEN', 403);
      }

      const revoked = db.securitySessions.filter(
        (s) => s.userId === requesterId && s.token !== currentToken,
      );
      db.securitySessions = db.securitySessions.filter(
        (s) => !(s.userId === requesterId && s.token !== currentToken),
      );
      for (const session of revoked) {
        db.sessions.delete(session.token);
      }
    },

    async getLoginHistory(requesterId) {
      await delay();
      assertViewAccess(db, requesterId, requesterId);
      return sortLoginHistoryByDate(db.loginHistory.filter((h) => h.userId === requesterId));
    },

    async getSecurityAlerts(requesterId) {
      await delay();
      assertViewAccess(db, requesterId, requesterId);
      return db.securityAlerts
        .filter((a) => a.userId === requesterId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async markAlertRead(alertId, requesterId) {
      await delay(50);
      assertViewAccess(db, requesterId, requesterId);
      const alert = db.securityAlerts.find((a) => a.id === alertId && a.userId === requesterId);
      if (!alert) throw new ApiError('Уведомление не найдено', 'NOT_FOUND', 404);
      alert.read = true;
    },
  };
}
