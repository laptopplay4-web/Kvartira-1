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
import { buildPersonalDataExport } from '@/services/profile/dataExport';
import { getAccountApprovalError, getAccountRejectError, getUserRoleChangeError } from '@/services/users/access';
import {
  ACCOUNT_APPROVED_NOTIFY_BODY,
  ACCOUNT_APPROVED_NOTIFY_LINK,
  ACCOUNT_APPROVED_NOTIFY_TITLE,
  ACCOUNT_STATUS_ACTIVE,
} from '@/services/users/accountStatus';
import { preserveOwnPhone, sanitizeUserPhoneForViewer, sanitizeUsersPhoneForViewer } from '@/services/users/helpers';
import { readPersistedLoginPhone, resolveOwnPhoneNumber } from '@/services/auth/ownPhone';
import { getRoleLabel } from '@/permissions';
import {
  normalizeDirectionIds,
  validateDirectionIdsSelection,
} from '@/services/directions/validation';
import {
  TEACHER_DIRECTIONS_SETUP_BODY,
  TEACHER_DIRECTIONS_SETUP_LINK,
  TEACHER_DIRECTIONS_SETUP_TITLE,
} from '@/services/directions/constants';
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
  let user = await resolveUserAvatars(mapUserRecord(record, { ownRecord: true }));
  user = preserveOwnPhone(user, requesterId, prevPhone);
  if (pb.authStore.record?.id === requesterId) {
    pb.authStore.save(pb.authStore.token, userToPbRecord(user, pb.authStore.record));
  }
  return user;
}

export const pocketbaseUsersApi: UsersApi = {
  async getUser(id, requesterId) {
    return withPbError(async () => {
      const pb = getPocketBase();
      const viewerRecord = await pb.collection('users').getOne(requesterId);
      const viewer = mapUserRecord(viewerRecord, { ownRecord: true });
      const record = await pb.collection('users').getOne(id);
      let user = await resolveUserAvatars(mapUserRecord(record, { ownRecord: id === requesterId }));
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
      const viewer = mapUserRecord(await pb.collection('users').getOne(requesterId), {
        ownRecord: true,
      });
      const records = await pb.collection('users').getFullList({ sort: 'firstName' });
      const users = await resolveUsersAvatars(records.map((record) => mapUserRecord(record)));
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
      const authId = pb.authStore.record?.id;
      const targetId =
        authId && (authId === requesterId || !requesterId) ? String(authId) : requesterId;

      const body: Record<string, unknown> = {};
      if (data.firstName !== undefined) body.firstName = data.firstName.trim();
      if (data.lastName !== undefined) body.lastName = data.lastName.trim();

      let normalizedDirectionIds: string[] | undefined;
      if (data.directionIds !== undefined) {
        let role: User['role'] = 'student';
        try {
          const current = mapUserRecord(await pb.collection('users').getOne(targetId), {
            ownRecord: true,
          });
          role = current.role;
        } catch {
          const authRole = pb.authStore.record?.role;
          if (authRole === 'student' || authRole === 'teacher' || authRole === 'admin') {
            role = authRole;
          }
        }

        const directions = await pb.collection('directions').getFullList({ sort: 'name' });
        const idsError = validateDirectionIdsSelection(
          data.directionIds,
          directions.map((d) => ({ id: d.id })),
          { required: role !== 'admin' },
        );
        if (idsError) {
          throw new ApiError(idsError, 'VALIDATION_ERROR', 400);
        }
        normalizedDirectionIds = normalizeDirectionIds(data.directionIds);
        body.directionIds = normalizedDirectionIds;
      }

      let record;
      try {
        record = await pb.collection('users').update(targetId, body);
      } catch (error) {
        if (error instanceof ClientResponseError && error.status === 404) {
          throw new ApiError(
            'Не удалось сохранить профиль. Выйдите и войдите снова, затем повторите.',
            'NOT_FOUND',
            404,
          );
        }
        throw error;
      }

      if (data.directionIds !== undefined) {
        try {
          const unread = await pb.collection('notifications').getFullList({
            filter: `user = "${targetId}" && urgent = true && read = false && title = "${TEACHER_DIRECTIONS_SETUP_TITLE}"`,
          });
          await Promise.all(
            unread.map((n) => pb.collection('notifications').update(n.id, { read: true })),
          );
        } catch {
          /* best-effort — missing urgent field must not block profile save */
        }
      }

      const saved = await saveSessionUser(record, targetId);
      if (normalizedDirectionIds !== undefined) {
        saved.directionIds = normalizedDirectionIds;
        if (pb.authStore.record?.id === targetId) {
          pb.authStore.save(pb.authStore.token, userToPbRecord(saved, pb.authStore.record));
        }
      }
      return saved;
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

      const body: Record<string, unknown> = { role, accountStatus: ACCOUNT_STATUS_ACTIVE };
      if (role === 'teacher') {
        body.directionIds = [];
      }

      const record = await pb.collection('users').update(userId, body);
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
        if (role === 'teacher') {
          await pb.collection('notifications').create({
            user: userId,
            type: 'system',
            title: TEACHER_DIRECTIONS_SETUP_TITLE,
            body: TEACHER_DIRECTIONS_SETUP_BODY,
            link: TEACHER_DIRECTIONS_SETUP_LINK,
            read: false,
            urgent: true,
          });
        }
      } catch {
        /* notification is best-effort */
      }

      return user;
    });
  },

  async approveUser(requesterId, userId) {
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

      const error = getAccountApprovalError(requester, target);
      if (error) {
        const forbidden = error === 'Нет доступа';
        throw new ApiError(error, forbidden ? 'FORBIDDEN' : 'VALIDATION_ERROR', forbidden ? 403 : 400);
      }

      const record = await pb.collection('users').update(userId, {
        accountStatus: ACCOUNT_STATUS_ACTIVE,
      });
      const user = await resolveUserAvatars(mapUserRecord(record));

      try {
        await pb.collection('notifications').create({
          user: userId,
          type: 'system',
          title: ACCOUNT_APPROVED_NOTIFY_TITLE,
          body: ACCOUNT_APPROVED_NOTIFY_BODY,
          link: ACCOUNT_APPROVED_NOTIFY_LINK,
          read: false,
        });
      } catch {
        /* notification is best-effort */
      }

      return user;
    });
  },

  async rejectUser(requesterId, userId) {
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

      const error = getAccountRejectError(requester, target);
      if (error) {
        const forbidden = error === 'Нет доступа';
        throw new ApiError(error, forbidden ? 'FORBIDDEN' : 'VALIDATION_ERROR', forbidden ? 403 : 400);
      }

      await pb.collection('users').delete(userId);
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

  async deleteOwnAccount(requesterId) {
    return withPbError(async () => {
      const pb = getPocketBase();
      // `users.deleteRule` only allows deleting yourself; the delete hook purges
      // dependent records and writes the audit entry before the row disappears.
      await pb.collection('users').delete(requesterId);
      pb.authStore.clear();
    });
  },

  async exportOwnData(requesterId) {
    return withPbError(async () => {
      // Imported lazily: the api factory imports this adapter.
      const { api } = await import('@/services/api');
      const data = await buildPersonalDataExport(api, requesterId);

      // Best-effort audit stamp — a failed log must not block the download.
      try {
        const pb = getPocketBase();
        await pb.send('/api/kvartira/data-export/ack', { method: 'POST', body: {} });
      } catch {
        /* ignore */
      }

      return data;
    });
  },
};
