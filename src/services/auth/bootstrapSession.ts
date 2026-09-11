import { isKnownUserRole } from '@/permissions';
import { getPocketBase, isPocketBaseMode } from '@/services/api/pocketbase/client';
import { mapUserRecord, type PbUserRecord } from '@/services/api/pocketbase/mappers';
import { sanitizePersistedUser } from '@/services/auth/sessionStorage';
import { resolveOwnPhoneNumber, readPbAuthPhone, readPbAuthPhoneFromStore } from '@/services/auth/ownPhone';
import type { AuthSession } from '@/types';

/** Resolve session from Zustand state or PocketBase `pocketbase_auth` localStorage. */
export function resolveBootstrapSession(
  zustandSession: AuthSession | null | undefined,
): AuthSession | null {
  if (zustandSession?.token && zustandSession.user?.id && isKnownUserRole(zustandSession.user.role)) {
    const phone = resolveOwnPhoneNumber(
      zustandSession.user.id,
      zustandSession.user.phone,
    );
    return {
      token: zustandSession.token,
      user: sanitizePersistedUser({ ...zustandSession.user, phone }),
    };
  }

  if (!isPocketBaseMode()) return null;

  const pb = getPocketBase();
  const record = pb.authStore.record as PbUserRecord | null;
  if (!pb.authStore.isValid || !pb.authStore.token || !record?.id) return null;

  const user = mapUserRecord(record, { ownRecord: true });
  if (!isKnownUserRole(user.role)) return null;

  const phone = resolveOwnPhoneNumber(
    user.id,
    user.phone,
    zustandSession?.user.phone,
    readPbAuthPhoneFromStore(user.id),
    readPbAuthPhone(user.id),
  );

  return {
    token: pb.authStore.token,
    user: sanitizePersistedUser({ ...user, phone }),
  };
}
