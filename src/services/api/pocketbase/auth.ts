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
import type { AuthSession, User } from '@/types';
import { digitsToStoredPhone, phoneFromSyntheticEmail } from '@/utils/phone';
import { needsTeacherDirectionSetup } from '@/services/directions/access';
import {
  TEACHER_DIRECTIONS_SETUP_BODY,
  TEACHER_DIRECTIONS_SETUP_LINK,
  TEACHER_DIRECTIONS_SETUP_TITLE,
} from '@/services/directions/constants';
import {
  normalizeDirectionIds,
  validateDirectionIdsSelection,
} from '@/services/directions/validation';
import {
  INVALID_REGISTRATION_INVITE_MESSAGE,
  MISSING_REGISTRATION_INVITE_MESSAGE,
  REGISTRATION_INVITE_HEADER,
} from '@/services/registration/constants';
import {
  isRegistrationInviteTokenFormat,
  normalizeRegistrationInviteToken,
} from '@/services/registration/invite';

async function ensureTeacherDirectionsSetupOnLogin(user: User): Promise<void> {
  if (!needsTeacherDirectionSetup(user)) return;
  const pb = getPocketBase();
  try {
    const existing = await pb.collection('notifications').getList(1, 1, {
      filter: `user = "${user.id}" && urgent = true && read = false && title = "${TEACHER_DIRECTIONS_SETUP_TITLE}"`,
    });
    if (existing.totalItems > 0) return;
    await pb.collection('notifications').create({
      user: user.id,
      type: 'system',
      title: TEACHER_DIRECTIONS_SETUP_TITLE,
      body: TEACHER_DIRECTIONS_SETUP_BODY,
      link: TEACHER_DIRECTIONS_SETUP_LINK,
      read: false,
      urgent: true,
    });
  } catch {
    /* best-effort */
  }
}

function buildSession(): AuthSession | null {
  const pb = getPocketBase();
  if (!pb.authStore.isValid || !pb.authStore.record) return null;
  return {
    user: mapUserRecord(pb.authStore.record, { ownRecord: true }),
    token: pb.authStore.token,
  };
}

async function buildResolvedSession(
  record: Parameters<typeof mapUserRecord>[0],
  token: string,
  phoneFallback?: string,
) {
  const user = await resolveUserAvatars(mapUserRecord(record, { ownRecord: true }));
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
      const session = await buildResolvedSession(authData.record, authData.token, identity);
      await ensureTeacherDirectionsSetupOnLogin(session.user);
      return session;
    });
  },

  async demoLogin(role) {
    // Demo credentials are public (mocks/seed.ts) — never usable against a
    // production build, which talks to a real PocketBase instance.
    if (import.meta.env.PROD) {
      throw new Error('Демо-вход отключён в production-сборке');
    }
    const account = DEMO_ACCOUNTS[role];
    return pocketbaseAuthApi.login(account.phone, account.password);
  },

  async validateRegistrationInvite(token) {
    return withPbError(async () => {
      const normalized = normalizeRegistrationInviteToken(token);
      if (!isRegistrationInviteTokenFormat(normalized)) {
        return { valid: false };
      }
      const pb = getPocketBase();
      const result = await pb.send('/api/kvartira/registration-invite/validate', {
        method: 'POST',
        body: { token: normalized },
      });
      return { valid: !!(result as { valid?: boolean })?.valid };
    });
  },

  async register(phone, password, firstName, lastName, directionIds, inviteToken) {
    return withPbError(async () => {
      const normalizedInvite = normalizeRegistrationInviteToken(inviteToken);
      if (!normalizedInvite) {
        throw new ApiError(MISSING_REGISTRATION_INVITE_MESSAGE, 'INVITE_REQUIRED', 403);
      }
      if (!isRegistrationInviteTokenFormat(normalizedInvite)) {
        throw new ApiError(INVALID_REGISTRATION_INVITE_MESSAGE, 'INVITE_INVALID', 403);
      }

      const pb = getPocketBase();
      const normalizedPhone = digitsToStoredPhone(phone);
      const directionRecords = await pb.collection('directions').getFullList({ fields: 'id' });
      const available = directionRecords.map((d) => ({ id: d.id }));
      const idsError = validateDirectionIdsSelection(directionIds, available, { required: true });
      if (idsError) {
        throw new ApiError(idsError, 'VALIDATION_ERROR', 400);
      }
      await pb.collection('users').create(
        {
          phone: normalizedPhone,
          password,
          passwordConfirm: password,
          firstName,
          lastName,
          directionIds: normalizeDirectionIds(directionIds),
        },
        {
          // Header (normalized by PB to x_registration_invite) + query backup
          // so browser CORS preflight cannot drop the invite.
          headers: {
            [REGISTRATION_INVITE_HEADER]: normalizedInvite,
          },
          invite: normalizedInvite,
        },
      );
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
