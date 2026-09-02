import { ClientResponseError } from 'pocketbase';
import type { UsersApi, UploadAvatarInput } from '@/services/api/types';
import { ApiError } from '@/services/api/types';
import { getPocketBase } from '@/services/api/pocketbase/client';
import { mapUserRecord, userToPbRecord } from '@/services/api/pocketbase/mappers';
import { withPbError } from '@/services/api/pocketbase/errors';
import {
  deleteStoredFiles,
  resolveUserAvatars,
  resolveUsersAvatars,
  uploadStoredFile,
} from '@/services/api/pocketbase/files';
import { validateUpdateProfileInput } from '@/services/profile/validation';
import { validateAvatarUpload } from '@/services/profile/avatar';
import { getUserRoleChangeError } from '@/services/users/access';
import { preserveOwnPhone, sanitizeUserPhoneForViewer, sanitizeUsersPhoneForViewer } from '@/services/users/helpers';
import { readPersistedLoginPhone, resolveOwnPhoneNumber } from '@/services/auth/ownPhone';
import { getRoleLabel } from '@/permissions';
import type { User } from '@/types';

async function saveSessionUser(record: Parameters<typeof mapUserRecord>[0], requesterId: string) {
  const pb = getPocketBase();
  const prevPhone = resolveOwnPhoneNumber(
    requesterId,
    pb.authStore.record?.id === requesterId && typeof pb.authStore.record.phone === 'string'
      ? pb.authStore.record.phone
      : undefined,
    readPersistedLoginPhone(requesterId),
  );
  let user = await resolveUserAvatars(mapUserRecord(record));
  user = preserveOwnPhone(user, requesterId, prevPhone);
  if (pb.authStore.record?.id === requesterId) {
    pb.authStore.save(pb.authStore.token, userToPbRecord(user));
  }
  return user;
}

export const pocketbaseUsersApi: UsersApi = {
  async getUser(id, requesterId) {
    return withPbError(async () => {
      const pb = getPocketBase();
      const viewerRecord = await pb.collection('users').getOne(requesterId);
      const viewer = mapUserRecord(viewerRecord);
      const record = await pb.collection('users').getOne(id);
      let user = await resolveUserAvatars(mapUserRecord(record));
      user = sanitizeUserPhoneForViewer(user, viewer);
      const fallbackPhone =
        id === requesterId
          ? resolveOwnPhoneNumber(
              requesterId,
              typeof viewerRecord.phone === 'string' ? viewerRecord.phone : undefined,
              viewer.phone,
              readPersistedLoginPhone(requesterId),
            )
          : '';
      return preserveOwnPhone(user, requesterId, fallbackPhone);
    });
  },

  async getAllUsers(requesterId) {
    return withPbError(async () => {
      const pb = getPocketBase();
      const viewer = mapUserRecord(await pb.collection('users').getOne(requesterId));
      const records = await pb.collection('users').getFullList({ sort: 'firstName' });
      const users = await resolveUsersAvatars(records.map(mapUserRecord));
      return sanitizeUsersPhoneForViewer(users, viewer);
    });
  },

  async updateProfile(requesterId, data) {
    const validationError = validateUpdateProfileInput(data);
    if (validationError) {
      throw new ApiError(validationError, 'VALIDATION_ERROR', 400);
    }

    return withPbError(async () => {
      const pb = getPocketBase();
      const body: Record<string, string> = {};
      if (data.firstName !== undefined) body.firstName = data.firstName.trim();
      if (data.lastName !== undefined) body.lastName = data.lastName.trim();

      const record = await pb.collection('users').update(requesterId, body);
      return saveSessionUser(record, requesterId);
    });
  },

  async updateUserRole(requesterId, userId, role) {
    return withPbError(async () => {
      const pb = getPocketBase();
      let requester: User;
      let target: User;
      try {
        requester = mapUserRecord(await pb.collection('users').getOne(requesterId));
        target = mapUserRecord(await pb.collection('users').getOne(userId));
      } catch (error) {
        if (error instanceof ClientResponseError && error.status === 404) {
          throw new ApiError('Пользователь не найден', 'NOT_FOUND', 404);
        }
        throw error;
      }

      const error = getUserRoleChangeError(requester, target, role);
      if (error) {
        const forbidden = error === 'Нет доступа';
        throw new ApiError(error, forbidden ? 'FORBIDDEN' : 'VALIDATION_ERROR', forbidden ? 403 : 400);
      }

      const record = await pb.collection('users').update(userId, { role });
      const user = await resolveUserAvatars(mapUserRecord(record));

      try {
        await pb.collection('notifications').create({
          user: userId,
          type: 'system',
          title: 'Роль изменена',
          body: `Ваша роль в школе: ${getRoleLabel(role)}`,
          link: '/profile',
          read: false,
        });
      } catch {
        /* notification is best-effort */
      }

      return user;
    });
  },

  async uploadAvatar(requesterId, input: UploadAvatarInput) {
    const validation = validateAvatarUpload(input);
    if (!validation.valid) {
      throw new ApiError(validation.message, 'VALIDATION_ERROR', 400);
    }

    return withPbError(async () => {
      const pb = getPocketBase();
      const current = mapUserRecord(await pb.collection('users').getOne(requesterId));
      const oldThumb = current.avatarUrl;
      const oldOriginal = current.avatarOriginalUrl;

      const thumb = await uploadStoredFile({
        userId: requesterId,
        purpose: 'avatar',
        contextId: requesterId,
        filename: 'avatar-thumb.jpg',
        mimeType: input.mimeType,
        size: input.size,
        dataUrl: input.dataUrl,
      });

      const body: Record<string, string> = {
        avatarUrl: thumb.url,
      };

      if (input.originalDataUrl) {
        const original = await uploadStoredFile({
          userId: requesterId,
          purpose: 'avatar',
          contextId: requesterId,
          filename: input.filename || 'avatar-original.jpg',
          mimeType: input.mimeType,
          size: Math.ceil((input.originalDataUrl.length * 3) / 4),
          dataUrl: input.originalDataUrl,
        });
        body.avatarOriginalUrl = original.url;
      } else if (!input.updateThumbnailOnly) {
        body.avatarOriginalUrl = thumb.url;
      }

      const record = await pb.collection('users').update(requesterId, body);

      const refsToDelete = input.updateThumbnailOnly ? [oldThumb] : [oldThumb, oldOriginal];
      await deleteStoredFiles(...refsToDelete);

      return saveSessionUser(record, requesterId);
    });
  },

  async removeAvatar(requesterId) {
    return withPbError(async () => {
      const pb = getPocketBase();
      const current = mapUserRecord(await pb.collection('users').getOne(requesterId));
      const oldThumb = current.avatarUrl;
      const oldOriginal = current.avatarOriginalUrl;

      const record = await pb.collection('users').update(requesterId, {
        avatarUrl: '',
        avatarOriginalUrl: '',
      });

      await deleteStoredFiles(oldThumb, oldOriginal);
      return saveSessionUser(record, requesterId);
    });
  },
};
