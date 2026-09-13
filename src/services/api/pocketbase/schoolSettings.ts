import { ClientResponseError } from 'pocketbase';
import type {
  SchoolSettingsApi,
  UpdateSchoolSettingsInput,
  UploadSchoolDirectionsVideoInput,
} from '@/services/api/types';
import { ApiError } from '@/services/api/types';
import { publicSchoolInfo as defaultSchoolInfo } from '@/mocks/seed';
import { getPocketBase } from '@/services/api/pocketbase/client';
import { withPbError } from '@/services/api/pocketbase/errors';
import { mapSchoolSettingsRecord } from '@/services/api/pocketbase/mappers';
import {
  deleteStoredFiles,
  resolveStoredFileUrl,
  uploadStoredFile,
} from '@/services/api/pocketbase/files';
import { canManageSchoolSettings } from '@/services/events/access';
import { validateSchoolSettingsInput } from '@/services/events/validation';
import { EMPTY_SCHOOL_SOCIAL_LINKS } from '@/services/school/constants';
import {
  buildSchoolContactsPayload,
  mergeSchoolSocialLinks,
  validateSchoolDirectionsVideoFile,
} from '@/services/school/helpers';
import {
  createRotatedRegistrationInvite,
  createSeedRegistrationInvite,
  ensurePrintableRegistrationInvite,
  extractRegistrationInviteFromContacts,
  toRegistrationInviteInfo,
  type RegistrationInviteSecret,
} from '@/services/registration/invite';
import { getRequesterUser } from '@/services/api/pocketbase/requester';
import type { PublicSchoolInfo, SchoolDirectionsVideo, User } from '@/types';

async function assertSchoolSettingsManage(requesterId: string): Promise<User> {
  const user = await getRequesterUser(requesterId);
  if (!canManageSchoolSettings(user)) {
    throw new ApiError('Нет доступа', 'FORBIDDEN', 403);
  }
  return user;
}

async function findSchoolSettingsRecord() {
  const pb = getPocketBase();
  const records = await pb.collection('school_settings').getList(1, 1, { sort: '-id' });
  return records.items[0] ?? null;
}

async function loadOrCreateSchoolSettingsRecord() {
  const existing = await findSchoolSettingsRecord();
  if (existing) return existing;

  const pb = getPocketBase();
  const seedInvite = createSeedRegistrationInvite();
  try {
    return await pb.collection('school_settings').create({
      name: defaultSchoolInfo.name,
      tagline: defaultSchoolInfo.tagline,
      about: defaultSchoolInfo.about,
      contacts: buildSchoolContactsPayload({
        contacts: defaultSchoolInfo.contacts,
        socialLinks: defaultSchoolInfo.socialLinks ?? EMPTY_SCHOOL_SOCIAL_LINKS,
        directionsVideo: defaultSchoolInfo.directionsVideo,
        registrationInvite: seedInvite,
      }),
    });
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 400) {
      const retry = await findSchoolSettingsRecord();
      if (retry) return retry;
    }
    throw error;
  }
}

function readInviteFromRecord(record: unknown): RegistrationInviteSecret {
  const contacts = (record as { contacts?: unknown } | null)?.contacts;
  return extractRegistrationInviteFromContacts(contacts) ?? createSeedRegistrationInvite();
}

function mergeSchoolSettings(
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

async function resolveSchoolSettings(settings: PublicSchoolInfo): Promise<PublicSchoolInfo> {
  if (!settings.directionsVideo?.url) return settings;
  const resolvedUrl = await resolveStoredFileUrl(settings.directionsVideo.url);
  if (!resolvedUrl || resolvedUrl === settings.directionsVideo.url) return settings;
  return {
    ...settings,
    directionsVideo: { ...settings.directionsVideo, url: resolvedUrl },
  };
}

function toPbUpdateBody(settings: PublicSchoolInfo, invite: RegistrationInviteSecret | null) {
  return {
    name: settings.name,
    tagline: settings.tagline,
    about: settings.about,
    contacts: buildSchoolContactsPayload({
      contacts: settings.contacts,
      socialLinks: settings.socialLinks ?? EMPTY_SCHOOL_SOCIAL_LINKS,
      directionsVideo: settings.directionsVideo,
      registrationInvite: invite,
    }),
  };
}

export const pocketbaseSchoolSettingsApi: SchoolSettingsApi = {
  async getSchoolSettings(requesterId) {
    return withPbError(async () => {
      await getRequesterUser(requesterId);
      const record = await findSchoolSettingsRecord();
      if (!record) {
        throw new ApiError('Настройки школы не найдены', 'NOT_FOUND', 404);
      }
      return resolveSchoolSettings(mapSchoolSettingsRecord(record));
    });
  },

  async updateSchoolSettings(input, requesterId) {
    return withPbError(async () => {
      await assertSchoolSettingsManage(requesterId);
      const record = await loadOrCreateSchoolSettingsRecord();
      const current = mapSchoolSettingsRecord(record);
      const invite = readInviteFromRecord(record);

      const validationError = validateSchoolSettingsInput(input, current);
      if (validationError) {
        throw new ApiError(validationError, 'VALIDATION', 400);
      }

      const updated = mergeSchoolSettings(current, input);
      if (input.directionsVideo === null && current.directionsVideo?.url) {
        await deleteStoredFiles(current.directionsVideo.url);
      }

      const pb = getPocketBase();
      const saved = await pb
        .collection('school_settings')
        .update(record.id, toPbUpdateBody(updated, invite));
      return resolveSchoolSettings(mapSchoolSettingsRecord(saved));
    });
  },

  async uploadDirectionsVideo(input: UploadSchoolDirectionsVideoInput, requesterId) {
    return withPbError(async () => {
      await assertSchoolSettingsManage(requesterId);

      const fileError = validateSchoolDirectionsVideoFile(input);
      if (fileError) throw new ApiError(fileError, 'VALIDATION', 400);

      const record = await loadOrCreateSchoolSettingsRecord();
      const current = mapSchoolSettingsRecord(record);
      const invite = readInviteFromRecord(record);

      const uploaded = await uploadStoredFile({
        userId: requesterId,
        purpose: 'school',
        contextId: record.id,
        filename: input.filename,
        mimeType: input.mimeType,
        size: input.size,
        dataUrl: input.dataUrl,
      });

      const video: SchoolDirectionsVideo = {
        url: uploaded.url,
        filename: uploaded.filename,
        mimeType: uploaded.mimeType,
        size: uploaded.size,
      };

      const next: PublicSchoolInfo = {
        ...current,
        socialLinks: current.socialLinks ?? EMPTY_SCHOOL_SOCIAL_LINKS,
        directionsVideo: video,
      };

      const pb = getPocketBase();
      await pb.collection('school_settings').update(record.id, toPbUpdateBody(next, invite));

      if (current.directionsVideo?.url) {
        await deleteStoredFiles(current.directionsVideo.url);
      }

      const resolvedUrl = await resolveStoredFileUrl(video.url);
      return { ...video, url: resolvedUrl ?? video.url };
    });
  },

  async removeDirectionsVideo(requesterId) {
    return withPbError(async () => {
      await assertSchoolSettingsManage(requesterId);
      const record = await loadOrCreateSchoolSettingsRecord();
      const current = mapSchoolSettingsRecord(record);
      const invite = readInviteFromRecord(record);

      const next: PublicSchoolInfo = {
        ...current,
        socialLinks: current.socialLinks ?? EMPTY_SCHOOL_SOCIAL_LINKS,
      };
      delete next.directionsVideo;

      const pb = getPocketBase();
      const saved = await pb
        .collection('school_settings')
        .update(record.id, toPbUpdateBody(next, invite));

      if (current.directionsVideo?.url) {
        await deleteStoredFiles(current.directionsVideo.url);
      }

      return resolveSchoolSettings(mapSchoolSettingsRecord(saved));
    });
  },

  async getRegistrationInvite(requesterId, origin) {
    return withPbError(async () => {
      await assertSchoolSettingsManage(requesterId);
      const record = await loadOrCreateSchoolSettingsRecord();
      const stored = extractRegistrationInviteFromContacts(record.contacts);
      const { invite, didRotate } = ensurePrintableRegistrationInvite(stored);
      if (didRotate) {
        const settings = mapSchoolSettingsRecord(record);
        const pb = getPocketBase();
        await pb
          .collection('school_settings')
          .update(record.id, toPbUpdateBody(settings, invite));
      }
      return toRegistrationInviteInfo(invite, origin);
    });
  },

  async rotateRegistrationInvite(requesterId, origin) {
    return withPbError(async () => {
      await assertSchoolSettingsManage(requesterId);
      const record = await loadOrCreateSchoolSettingsRecord();
      const settings = mapSchoolSettingsRecord(record);
      const invite = createRotatedRegistrationInvite();
      const pb = getPocketBase();
      await pb.collection('school_settings').update(record.id, toPbUpdateBody(settings, invite));
      return toRegistrationInviteInfo(invite, origin);
    });
  },
};
