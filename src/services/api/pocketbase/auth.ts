import type {
  AuthApi,
  CompletePasswordResetInput,
  PasswordResetRequestResult,
} from '@/services/api/types';
import { ApiError } from '@/services/api/types';
import { DEMO_ACCOUNTS } from '@/mocks/seed';
import {
  clearPocketBaseAuth,
  getPocketBase,
  setPocketBaseAuth,
} from '@/services/api/pocketbase/client';
import { mapUserRecord } from '@/services/api/pocketbase/mappers';
import { withPbError } from '@/services/api/pocketbase/errors';
import type { AuthSession } from '@/types';
import { digitsToStoredPhone } from '@/utils/phone';

function buildSession(): AuthSession | null {
  const pb = getPocketBase();
  if (!pb.authStore.isValid || !pb.authStore.record) return null;
  return {
    user: mapUserRecord(pb.authStore.record),
    token: pb.authStore.token,
  };
}

export const pocketbaseAuthApi: AuthApi = {
  async login(phone, password) {
    return withPbError(async () => {
      const pb = getPocketBase();
      const identity = digitsToStoredPhone(phone);
      const authData = await pb.collection('users').authWithPassword(identity, password);
      const session: AuthSession = {
        user: mapUserRecord(authData.record),
        token: authData.token,
      };
      setPocketBaseAuth(session.token, session.user);
      return session;
    });
  },

  async demoLogin(role) {
    const account = DEMO_ACCOUNTS[role];
    return pocketbaseAuthApi.login(account.phone, account.password);
  },

  async register(phone, password, firstName, lastName) {
    return withPbError(async () => {
      const pb = getPocketBase();
      const normalizedPhone = digitsToStoredPhone(phone);
      await pb.collection('users').create({
        phone: normalizedPhone,
        password,
        passwordConfirm: password,
        firstName,
        lastName,
      });
      return pocketbaseAuthApi.login(normalizedPhone, password);
    });
  },

  async requestPasswordReset(_phone: string): Promise<PasswordResetRequestResult> {
    throw new ApiError(
      'Восстановление пароля через PocketBase ещё не подключено',
      'NOT_IMPLEMENTED',
      501,
    );
  },

  async completePasswordReset(_input: CompletePasswordResetInput): Promise<void> {
    throw new ApiError(
      'Восстановление пароля через PocketBase ещё не подключено',
      'NOT_IMPLEMENTED',
      501,
    );
  },

  async logout() {
    clearPocketBaseAuth();
  },

  async getSession() {
    return buildSession();
  },

  async refreshSession() {
    return withPbError(async () => {
      const pb = getPocketBase();
      const userId = pb.authStore.record?.id;
      if (!pb.authStore.isValid || !userId || !pb.authStore.token) return null;

      const record = await pb.collection('users').getOne(userId);
      const session: AuthSession = {
        user: mapUserRecord(record),
        token: pb.authStore.token,
      };
      setPocketBaseAuth(session.token, session.user);
      return session;
    });
  },
};
