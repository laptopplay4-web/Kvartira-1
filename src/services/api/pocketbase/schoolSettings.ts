import { ClientResponseError } from 'pocketbase';
import type { SchoolSettingsApi, UpdateSchoolSettingsInput } from '@/services/api/types';
import { ApiError } from '@/services/api/types';
import { publicSchoolInfo as defaultSchoolInfo } from '@/mocks/seed';
import { getPocketBase } from '@/services/api/pocketbase/client';
import { withPbError } from '@/services/api/pocketbase/errors';
import { mapSchoolSettingsRecord, mapUserRecord } from '@/services/api/pocketbase/mappers';
import { canManageSchoolSettings } from '@/services/events/access';
import { validateSchoolSettingsInput } from '@/services/events/validation';
import type { PublicSchoolInfo, User } from '@/types';

async function getRequesterUser(requesterId: string): Promise<User> {
  const pb = getPocketBase();
  try {
    const record = await pb.collection('users').getOne(requesterId);
    return mapUserRecord(record);
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      throw new ApiError('Пользователь не найден', 'NOT_FOUND', 404);
    }
    throw error;
  }
}

async function assertSchoolSettingsAccess(requesterId: string): Promise<User> {
  const user = await getRequesterUser(requesterId);
  if (!canManageSchoolSettings(user)) {
    throw new ApiError('Нет доступа', 'FORBIDDEN', 403);
  }
  return user;
}

async function loadSchoolSettingsRecord() {
  const pb = getPocketBase();
  const records = await pb.collection('school_settings').getList(1, 1, { sort: '-id' });
  if (records.items[0]) {
    return records.items[0];
  }

  try {
    return await pb.collection('school_settings').create({
      name: defaultSchoolInfo.name,
      tagline: defaultSchoolInfo.tagline,
      about: defaultSchoolInfo.about,
      contacts: defaultSchoolInfo.contacts,
    });
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 400) {
      const retry = await pb.collection('school_settings').getList(1, 1, { sort: '-id' });
      if (retry.items[0]) return retry.items[0];
    }
    throw error;
  }
}

function mergeSchoolSettings(
  current: PublicSchoolInfo,
  input: UpdateSchoolSettingsInput,
): PublicSchoolInfo {
  return {
    name: (input.name ?? current.name).trim(),
    tagline: (input.tagline ?? current.tagline).trim(),
    about: (input.about ?? current.about).trim(),
    contacts: {
      phone: (input.contacts?.phone ?? current.contacts.phone).trim(),
      email: (input.contacts?.email ?? current.contacts.email).trim(),
      address: (input.contacts?.address ?? current.contacts.address).trim(),
      workingHours: (input.contacts?.workingHours ?? current.contacts.workingHours).trim(),
    },
  };
}

export const pocketbaseSchoolSettingsApi: SchoolSettingsApi = {
  async getSchoolSettings(requesterId) {
    return withPbError(async () => {
      await assertSchoolSettingsAccess(requesterId);
      const record = await loadSchoolSettingsRecord();
      return mapSchoolSettingsRecord(record);
    });
  },

  async updateSchoolSettings(input, requesterId) {
    return withPbError(async () => {
      await assertSchoolSettingsAccess(requesterId);
      const record = await loadSchoolSettingsRecord();
      const current = mapSchoolSettingsRecord(record);

      const validationError = validateSchoolSettingsInput(input, current);
      if (validationError) {
        throw new ApiError(validationError, 'VALIDATION', 400);
      }

      const updated = mergeSchoolSettings(current, input);
      const pb = getPocketBase();
      const saved = await pb.collection('school_settings').update(record.id, {
        name: updated.name,
        tagline: updated.tagline,
        about: updated.about,
        contacts: updated.contacts,
      });
      return mapSchoolSettingsRecord(saved);
    });
  },
};
