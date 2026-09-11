import type {
  SchoolSettingsApi,
  UpdateSchoolSettingsInput,
  UploadSchoolDirectionsVideoInput,
} from '@/services/api/types';
import { ApiError } from '@/services/api/types';
import { canManageSchoolSettings } from '@/services/events/access';
import { validateSchoolSettingsInput } from '@/services/events/validation';
import { EMPTY_SCHOOL_SOCIAL_LINKS } from '@/services/school/constants';
import {
  mergeSchoolSocialLinks,
  validateSchoolDirectionsVideoFile,
} from '@/services/school/helpers';
import {
  createRotatedRegistrationInvite,
  createSeedRegistrationInvite,
  toRegistrationInviteInfo,
  type RegistrationInviteSecret,
} from '@/services/registration/invite';
import type { PublicSchoolInfo } from '@/types';

export interface MockSchoolSettingsDb {
  schoolInfo: PublicSchoolInfo;
  registrationInvite: RegistrationInviteSecret;
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

  function assertAuthenticated(requesterId: string) {
    const user = getUserById(requesterId);
    if (!user) {
      throw new ApiError('Нет доступа', 'FORBIDDEN', 403);
    }
  }

  function ensureInvite(): RegistrationInviteSecret {
    if (!db.registrationInvite?.token) {
      db.registrationInvite = createSeedRegistrationInvite();
    }
    return db.registrationInvite;
  }

  function mergeSettings(
    current: PublicSchoolInfo,
    input: UpdateSchoolSettingsInput,
  ): PublicSchoolInfo {
    const next: PublicSchoolInfo = {
      name: (input.name ?? current.name).trim(),
      tagline: (input.tagline ?? current.tagline).trim(),
      about: (input.about ?? current.about).trim(),
      contacts: {
        phone: (input.contacts?.phone ?? current.contacts.phone).trim(),
        email: (input.contacts?.email ?? current.contacts.email).trim(),
        address: (input.contacts?.address ?? current.contacts.address).trim(),
        workingHours: (input.contacts?.workingHours ?? current.contacts.workingHours).trim(),
      },
      socialLinks: mergeSchoolSocialLinks(
        current.socialLinks ?? EMPTY_SCHOOL_SOCIAL_LINKS,
        input.socialLinks,
      ),
    };

    if (input.directionsVideo === null) {
      delete next.directionsVideo;
    } else if (input.directionsVideo) {
      next.directionsVideo = { ...input.directionsVideo };
    } else if (current.directionsVideo) {
      next.directionsVideo = { ...current.directionsVideo };
    }

    return next;
  }

  return {
    async getSchoolSettings(requesterId) {
      await delay();
      assertAuthenticated(requesterId);
      return structuredClone(db.schoolInfo);
    },

    async updateSchoolSettings(input, requesterId) {
      await delay();
      assertManageAccess(requesterId);

      const validationError = validateSchoolSettingsInput(input, db.schoolInfo);
      if (validationError) {
        throw new ApiError(validationError, 'VALIDATION', 400);
      }

      db.schoolInfo = mergeSettings(db.schoolInfo, input);
      return structuredClone(db.schoolInfo);
    },

    async uploadDirectionsVideo(input: UploadSchoolDirectionsVideoInput, requesterId) {
      await delay(100);
      assertManageAccess(requesterId);

      const fileError = validateSchoolDirectionsVideoFile(input);
      if (fileError) throw new ApiError(fileError, 'VALIDATION', 400);

      const video = {
        url: input.dataUrl,
        filename: input.filename.trim(),
        mimeType: input.mimeType,
        size: input.size,
      };
      db.schoolInfo = {
        ...db.schoolInfo,
        socialLinks: db.schoolInfo.socialLinks ?? { ...EMPTY_SCHOOL_SOCIAL_LINKS },
        directionsVideo: video,
      };
      return structuredClone(video);
    },

    async removeDirectionsVideo(requesterId) {
      await delay();
      assertManageAccess(requesterId);
      const { directionsVideo: _, ...rest } = db.schoolInfo;
      db.schoolInfo = {
        ...rest,
        socialLinks: rest.socialLinks ?? { ...EMPTY_SCHOOL_SOCIAL_LINKS },
      };
      return structuredClone(db.schoolInfo);
    },

    async getRegistrationInvite(requesterId, origin) {
      await delay();
      assertManageAccess(requesterId);
      return toRegistrationInviteInfo(ensureInvite(), origin);
    },

    async rotateRegistrationInvite(requesterId, origin) {
      await delay();
      assertManageAccess(requesterId);
      db.registrationInvite = createRotatedRegistrationInvite();
      return toRegistrationInviteInfo(db.registrationInvite, origin);
    },
  };
}

export type { UpdateSchoolSettingsInput };
