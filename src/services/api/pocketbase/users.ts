import type { UsersApi, UploadAvatarInput } from '@/services/api/types';
import { ApiError } from '@/services/api/types';
import { getPocketBase } from '@/services/api/pocketbase/client';
import { mapUserRecord } from '@/services/api/pocketbase/mappers';
import { withPbError } from '@/services/api/pocketbase/errors';
import { validateUpdateProfileInput } from '@/services/profile/validation';
import { validateAvatarUpload } from '@/services/profile/avatar';

export const pocketbaseUsersApi: UsersApi = {
  async getUser(id) {
    return withPbError(async () => {
      const pb = getPocketBase();
      const record = await pb.collection('users').getOne(id);
      return mapUserRecord(record);
    });
  },

  async getAllUsers() {
    return withPbError(async () => {
      const pb = getPocketBase();
      const records = await pb.collection('users').getFullList({ sort: 'firstName' });
      return records.map(mapUserRecord);
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
      if (data.phone !== undefined) body.phone = data.phone;

      const record = await pb.collection('users').update(requesterId, body);
      const user = mapUserRecord(record);

      if (pb.authStore.record?.id === requesterId) {
        pb.authStore.save(pb.authStore.token, record);
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
      const body: Record<string, string> = {
        avatarUrl: input.dataUrl,
      };

      if (input.originalDataUrl) {
        body.avatarOriginalUrl = input.originalDataUrl;
      } else if (!input.updateThumbnailOnly) {
        body.avatarOriginalUrl = input.dataUrl;
      }

      const record = await pb.collection('users').update(requesterId, body);
      const user = mapUserRecord(record);

      if (pb.authStore.record?.id === requesterId) {
        pb.authStore.save(pb.authStore.token, record);
      }

      return user;
    });
  },

  async removeAvatar(requesterId) {
    return withPbError(async () => {
      const pb = getPocketBase();
      const record = await pb.collection('users').update(requesterId, {
        avatarUrl: '',
        avatarOriginalUrl: '',
      });
      const user = mapUserRecord(record);

      if (pb.authStore.record?.id === requesterId) {
        pb.authStore.save(pb.authStore.token, record);
      }

      return user;
    });
  },
};
