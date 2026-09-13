import { ClientResponseError } from 'pocketbase';
import type { User } from '@/types';
import { ApiError } from '@/services/api/types';
import { getPocketBase } from '@/services/api/pocketbase/client';
import { mapUserRecord } from '@/services/api/pocketbase/mappers';

/**
 * Load the requesting user for RBAC.
 * When `userId` matches the current PocketBase auth record, skip a redundant `getOne`.
 * Never short-circuits for other users (IDOR-safe).
 */
export async function getRequesterUser(userId: string): Promise<User> {
  const pb = getPocketBase();
  const authId = pb.authStore.record?.id;
  if (pb.authStore.isValid && authId != null && String(authId) === String(userId)) {
    return mapUserRecord(pb.authStore.record!, { ownRecord: true });
  }

  try {
    const record = await pb.collection('users').getOne(userId);
    return mapUserRecord(record, {
      ownRecord: String(record.id) === String(userId),
    });
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      throw new ApiError('Пользователь не найден', 'NOT_FOUND', 404);
    }
    throw error;
  }
}
