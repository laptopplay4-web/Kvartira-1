import { ClientResponseError } from 'pocketbase';
import type { ChangePasswordInput, SecurityApi } from '@/services/api/types';
import { ApiError } from '@/services/api/types';
import { getPocketBase } from '@/services/api/pocketbase/client';
import { withPbError } from '@/services/api/pocketbase/errors';
import { escapePbFilter } from '@/services/api/pocketbase/helpers';
import {
  mapLoginHistoryRecord,
  mapSecurityAlertRecord,
  mapSecuritySessionRecord,
  mapUserRecord,
} from '@/services/api/pocketbase/mappers';
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
import { MIN_PASSWORD_LENGTH } from '@/services/security/constants';
import type { SecurityOverview, User } from '@/types';

async function getRequesterUser(userId: string): Promise<User> {
  const pb = getPocketBase();
  try {
    const record = await pb.collection('users').getOne(userId);
    return mapUserRecord(record);
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      throw new ApiError('Пользователь не найден', 'NOT_FOUND', 404);
    }
    throw error;
  }
}

function assertViewAccess(requesterId: string, user: User): void {
  if (!canViewSecurity(user, requesterId)) {
    throw new ApiError('Нет доступа к настройкам безопасности', 'FORBIDDEN', 403);
  }
}

function userFilter(userId: string): string {
  return `user = "${escapePbFilter(userId)}"`;
}

async function getPasswordChangedAt(userId: string): Promise<string | undefined> {
  const pb = getPocketBase();
  const records = await pb.collection('notifications').getList(1, 1, {
    filter: `${userFilter(userId)} && type = "system" && title = "Пароль изменён"`,
    sort: '-id',
  });
  const notification = records.items[0];
  if (!notification) return undefined;
  return notification.getString('created') || notification.getString('createdAt');
}

async function createSecurityNotification(
  userId: string,
  title: string,
  body: string,
  link = '/profile/settings/security',
): Promise<void> {
  const pb = getPocketBase();
  await pb.collection('notifications').create({
    user: userId,
    type: 'system',
    title,
    body,
    link,
    read: false,
  });
}

export const pocketbaseSecurityApi: SecurityApi = {
  async getOverview(requesterId) {
    return withPbError(async () => {
      const user = await getRequesterUser(requesterId);
      assertViewAccess(requesterId, user);

      const pb = getPocketBase();
      const [sessions, history, passwordChangedAt] = await Promise.all([
        pb.collection('security_sessions').getFullList({ filter: userFilter(requesterId) }),
        pb.collection('login_history').getFullList({ filter: userFilter(requesterId) }),
        getPasswordChangedAt(requesterId),
      ]);

      const loginEntries = history.map(mapLoginHistoryRecord);
      const sessionsResolved = resolveSecuritySessions(sessions.map(mapSecuritySessionRecord));
      const overview: SecurityOverview = {
        activeSessions: sessionsResolved.length,
        lastLoginAt: getLastSuccessfulLogin(loginEntries),
        passwordChangedAt,
      };
      return overview;
    });
  },

  async changePassword(requesterId, input: ChangePasswordInput) {
    return withPbError(async () => {
      const user = await getRequesterUser(requesterId);
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
      if (input.currentPassword === input.newPassword) {
        throw new ApiError('Новый пароль должен отличаться от текущего', 'VALIDATION', 400);
      }

      const pb = getPocketBase();
      await pb.collection('users').update(requesterId, {
        oldPassword: input.currentPassword,
        password: input.newPassword,
        passwordConfirm: input.newPassword,
      });

      await createSecurityNotification(
        requesterId,
        'Пароль изменён',
        'Пароль вашего аккаунта был успешно обновлён.',
      );
    });
  },

  async getSessions(requesterId, _currentToken) {
    return withPbError(async () => {
      const user = await getRequesterUser(requesterId);
      assertViewAccess(requesterId, user);

      const pb = getPocketBase();
      const records = await pb.collection('security_sessions').getFullList({
        filter: userFilter(requesterId),
        sort: '-lastActiveAt',
      });
      return resolveSecuritySessions(records.map(mapSecuritySessionRecord));
    });
  },

  async revokeSession(sessionId, requesterId, _currentToken) {
    return withPbError(async () => {
      const user = await getRequesterUser(requesterId);
      if (!canManageSessions(user, requesterId)) {
        throw new ApiError('Нет доступа к управлению сессиями', 'FORBIDDEN', 403);
      }

      const pb = getPocketBase();
      let record;
      try {
        record = await pb.collection('security_sessions').getOne(sessionId);
      } catch (error) {
        if (error instanceof ClientResponseError && error.status === 404) {
          throw new ApiError('Сессия не найдена', 'NOT_FOUND', 404);
        }
        throw error;
      }

      const sessions = resolveSecuritySessions([mapSecuritySessionRecord(record)]);
      const session = sessions[0];
      if (session.userId !== requesterId) {
        throw new ApiError('Сессия не найдена', 'NOT_FOUND', 404);
      }
      if (session.isCurrent) {
        throw new ApiError('Нельзя завершить текущую сессию', 'VALIDATION', 400);
      }

      await pb.collection('security_sessions').delete(sessionId);
    });
  },

  async revokeAllOtherSessions(requesterId, _currentToken) {
    return withPbError(async () => {
      const user = await getRequesterUser(requesterId);
      if (!canManageSessions(user, requesterId)) {
        throw new ApiError('Нет доступа к управлению сессиями', 'FORBIDDEN', 403);
      }

      const pb = getPocketBase();
      const records = await pb.collection('security_sessions').getFullList({
        filter: userFilter(requesterId),
        sort: '-lastActiveAt',
      });
      const sessions = resolveSecuritySessions(records.map(mapSecuritySessionRecord));

      for (const session of sessions) {
        if (!session.isCurrent) {
          await pb.collection('security_sessions').delete(session.id);
        }
      }
    });
  },

  async getLoginHistory(requesterId) {
    return withPbError(async () => {
      const user = await getRequesterUser(requesterId);
      assertViewAccess(requesterId, user);

      const pb = getPocketBase();
      const records = await pb.collection('login_history').getFullList({
        filter: userFilter(requesterId),
        sort: '-id',
      });
      return sortLoginHistoryByDate(records.map(mapLoginHistoryRecord));
    });
  },

  async getSecurityAlerts(requesterId) {
    return withPbError(async () => {
      const user = await getRequesterUser(requesterId);
      assertViewAccess(requesterId, user);

      const pb = getPocketBase();
      const records = await pb.collection('security_alerts').getFullList({
        filter: userFilter(requesterId),
        sort: '-id',
      });
      return records.map(mapSecurityAlertRecord);
    });
  },

  async markAlertRead(alertId, requesterId) {
    return withPbError(async () => {
      const user = await getRequesterUser(requesterId);
      assertViewAccess(requesterId, user);

      const pb = getPocketBase();
      let record;
      try {
        record = await pb.collection('security_alerts').getOne(alertId);
      } catch (error) {
        if (error instanceof ClientResponseError && error.status === 404) {
          throw new ApiError('Уведомление не найдено', 'NOT_FOUND', 404);
        }
        throw error;
      }

      const alert = mapSecurityAlertRecord(record);
      if (alert.userId !== requesterId) {
        throw new ApiError('Уведомление не найдено', 'NOT_FOUND', 404);
      }

      await pb.collection('security_alerts').update(alertId, { read: true });
    });
  },
};
