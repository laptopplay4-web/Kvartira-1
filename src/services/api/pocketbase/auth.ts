import type {
  AuthApi,
  CompletePasswordResetInput,
  PasswordResetRequestResult,
} from '@/services/api/types';
import { ClientResponseError } from 'pocketbase';
import { ApiError } from '@/services/api/types';
import { DEMO_ACCOUNTS } from '@/mocks/seed';
import {
  clearPocketBaseAuth,
  getPocketBase,
  setPocketBaseAuth,
} from '@/services/api/pocketbase/client';
import { mapUserRecord } from '@/services/api/pocketbase/mappers';
import { mapPocketBaseError, withPbError } from '@/services/api/pocketbase/errors';
import { resolveUserAvatars } from '@/services/api/pocketbase/files';
import type { AuthSession } from '@/types';
import { digitsToStoredPhone, phoneFromSyntheticEmail } from '@/utils/phone';

function buildSession(): AuthSession | null {
  const pb = getPocketBase();
  if (!pb.authStore.isValid || !pb.authStore.record) return null;
  return {
    user: mapUserRecord(pb.authStore.record),
    token: pb.authStore.token,
  };
}

async function buildResolvedSession(
  record: Parameters<typeof mapUserRecord>[0],
  token: string,
  phoneFallback?: string,
) {
  const user = await resolveUserAvatars(mapUserRecord(record));
  // PB onRecordEnrich may omit phone for non-owner responses; keep identity/previous.
  if (!user.phone && phoneFallback) user.phone = phoneFallback;
  const session: AuthSession = { user, token };
  setPocketBaseAuth(session.token, session.user);
  return session;
}

export const pocketbaseAuthApi: AuthApi = {
  async login(phone, password) {
    return withPbError(async () => {
      const pb = getPocketBase();
      const identity = digitsToStoredPhone(phone);
      const authData = await pb.collection('users').authWithPassword(identity, password);
      return buildResolvedSession(authData.record, authData.token, identity);
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
      'Для сброса пароля обратитесь к администратору школы',
      'CONTACT_ADMIN',
      400,
    );
  },

  async completePasswordReset(_input: CompletePasswordResetInput): Promise<void> {
    throw new ApiError(
      'Для сброса пароля обратитесь к администратору школы',
      'CONTACT_ADMIN',
      400,
    );
  },

  async logout() {
    clearPocketBaseAuth();
  },

  async getSession() {
    return buildSession();
  },

  async refreshSession() {
    const pb = getPocketBase();
    const userId = pb.authStore.record?.id;
    if (!pb.authStore.isValid || !userId || !pb.authStore.token) return null;

    try {
      const record = await pb.collection('users').getOne(userId);
      const authRecord = pb.authStore.record as { phone?: string; email?: string } | null;
      const prevPhone =
        typeof authRecord?.phone === 'string' ? authRecord.phone : '';
      const email =
        (typeof authRecord?.email === 'string' && authRecord.email) ||
        (typeof (record as { email?: string }).email === 'string'
          ? (record as { email?: string }).email
          : undefined);
      return buildResolvedSession(
        record,
        pb.authStore.token,
        prevPhone || phoneFromSyntheticEmail(email) || undefined,
      );
    } catch (error) {
      if (
        error instanceof ClientResponseError &&
        (error.status === 404 || error.status === 401 || error.status === 403)
      ) {
        clearPocketBaseAuth();
        throw mapPocketBaseError(error);
      }
      throw mapPocketBaseError(error);
    }
  },
};
