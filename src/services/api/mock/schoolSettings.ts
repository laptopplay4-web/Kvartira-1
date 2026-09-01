import type { SchoolSettingsApi, UpdateSchoolSettingsInput } from '@/services/api/types';
import { ApiError } from '@/services/api/types';
import { canManageSchoolSettings } from '@/services/events/access';
import { validateSchoolSettingsInput } from '@/services/events/validation';
import type { PublicSchoolInfo } from '@/types';

export interface MockSchoolSettingsDb {
  schoolInfo: PublicSchoolInfo;
}

export function createMockSchoolSettingsApi(
  db: MockSchoolSettingsDb,
  delay: (ms?: number) => Promise<void>,
  getUserById: (id: string) => { role: string } | undefined,
): SchoolSettingsApi {
  function assertManageAccess(requesterId: string) {
    const user = getUserById(requesterId);
    if (!user || !canManageSchoolSettings(user as Parameters<typeof canManageSchoolSettings>[0])) {
      throw new ApiError('Нет доступа', 'FORBIDDEN', 403);
    }
  }

  return {
    async getSchoolSettings(requesterId) {
      await delay();
      assertManageAccess(requesterId);
      return structuredClone(db.schoolInfo);
    },

    async updateSchoolSettings(input, requesterId) {
      await delay();
      assertManageAccess(requesterId);

      const validationError = validateSchoolSettingsInput(input, db.schoolInfo);
      if (validationError) {
        throw new ApiError(validationError, 'VALIDATION', 400);
      }

      db.schoolInfo = {
        name: (input.name ?? db.schoolInfo.name).trim(),
        tagline: (input.tagline ?? db.schoolInfo.tagline).trim(),
        about: (input.about ?? db.schoolInfo.about).trim(),
        contacts: {
          phone: (input.contacts?.phone ?? db.schoolInfo.contacts.phone).trim(),
          email: (input.contacts?.email ?? db.schoolInfo.contacts.email).trim(),
          address: (input.contacts?.address ?? db.schoolInfo.contacts.address).trim(),
          workingHours: (input.contacts?.workingHours ?? db.schoolInfo.contacts.workingHours).trim(),
        },
      };

      return structuredClone(db.schoolInfo);
    },
  };
}

export type { UpdateSchoolSettingsInput };
