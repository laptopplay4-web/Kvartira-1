import { ClientResponseError, type RecordModel } from 'pocketbase';
import type {
  CreateEventInput,
  EventsApi,
  UpdateEventInput,
} from '@/services/api/types';
import { ApiError } from '@/services/api/types';
import { getPocketBase } from '@/services/api/pocketbase/client';
import { withPbError, mapPocketBaseError } from '@/services/api/pocketbase/errors';
import {
  mapEventRecord,
  mapEventRegistrationRecord,
  mapUserRecord,
} from '@/services/api/pocketbase/mappers';
import {
  deleteStoredFiles,
  isStoredFileRef,
  resolveStoredFileUrl,
  resolveUsersAvatars,
  uploadStoredFile,
} from '@/services/api/pocketbase/files';
import { escapePbFilter, pbEqOr } from '@/services/api/pocketbase/helpers';
import { canManageEvents, canRegisterForEvents, canViewSchoolEvent } from '@/services/events/access';
import { getEventRegisteredCount, presentSchoolEvent } from '@/services/events/registration';
import {
  normalizeCompetitionApplication,
  normalizeEventInput,
  validateCompetitionApplication,
  validateEventInput,
} from '@/services/events/validation';
import { resolveEventImageWriteInput } from '@/services/events/imageWrite';
import { sanitizeUserPhoneForViewer } from '@/services/users/helpers';
import { getRequesterUser } from '@/services/api/pocketbase/requester';
import type { SchoolEvent, User } from '@/types';

function relIdFromPb(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value) {
    return String((value as { id: string }).id);
  }
  return '';
}

async function assertEventsAdminAccess(requesterId: string): Promise<User> {
  const user = await getRequesterUser(requesterId);
  if (!canManageEvents(user)) {
    throw new ApiError('Нет доступа', 'FORBIDDEN', 403);
  }
  return user;
}

async function resolveEventImage(event: SchoolEvent): Promise<SchoolEvent> {
  if (!event.imageUrl) return event;
  const resolved = await resolveStoredFileUrl(event.imageUrl);
  if (resolved === event.imageUrl) return event;
  return { ...event, imageUrl: resolved };
}

async function presentPbEvent(
  event: SchoolEvent,
  viewerId: string,
  viewer?: User | null,
  options?: { forceRegistered?: boolean },
): Promise<SchoolEvent> {
  const resolvedViewer =
    viewer !== undefined ? viewer : await getRequesterUser(viewerId).catch(() => null);
  const hideRoster = !canManageEvents(resolvedViewer);

  let source = event;
  if (options?.forceRegistered) {
    const ids = event.registeredUserIds.includes(viewerId)
      ? event.registeredUserIds
      : [...event.registeredUserIds, viewerId];
    source = {
      ...event,
      isRegistered: true,
      registeredUserIds: ids,
      registeredCount: Math.max(getEventRegisteredCount(event), ids.length),
    };
  }

  const presented = presentSchoolEvent(source, viewerId, { hideRoster });
  return resolveEventImage(presented);
}

/** Own registration rows — roster sync may lag behind create. */
async function loadOwnRegisteredEventIds(userId: string): Promise<Set<string>> {
  const pb = getPocketBase();
  try {
    const regs = await pb.collection('event_registrations').getFullList({
      filter: `user = "${userId}"`,
    });
    return new Set(regs.map((reg) => relIdFromPb(reg.get('event'))).filter(Boolean));
  } catch {
    return new Set();
  }
}

async function hasOwnRegistration(eventId: string, userId: string): Promise<boolean> {
  const pb = getPocketBase();
  try {
    await pb
      .collection('event_registrations')
      .getFirstListItem(`event = "${eventId}" && user = "${userId}"`);
    return true;
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) return false;
    return false;
  }
}

/** After create: notify students (events tab badge; not inbox). */
async function notifyStudentsNewEventFromClient(
  event: Pick<SchoolEvent, 'id' | 'title' | 'type' | 'invitedUserIds'>,
): Promise<void> {
  const pb = getPocketBase();
  const title = 'Новое мероприятие';
  const body = event.title || 'Мероприятие школы';
  const link = `/events/${event.id}`;

  let studentIds: string[] = [];
  try {
    if (event.type === 'invited') {
      studentIds = [...(event.invitedUserIds ?? [])];
    } else {
      const students = await pb.collection('users').getFullList({
        filter: 'role = "student"',
      });
      studentIds = students.map((s) => s.id);
    }
  } catch {
    return;
  }

  await Promise.all(
    studentIds.map(async (userId) => {
      try {
        await pb.collection('notifications').create({
          user: userId,
          type: 'event',
          title,
          body,
          link,
        });
      } catch {
        /* best-effort */
      }
    }),
  );
}

async function loadEventOrThrow(id: string): Promise<SchoolEvent> {
  const pb = getPocketBase();
  try {
    const record = await pb.collection('events').getOne(id);
    return mapEventRecord(record);
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      throw new ApiError('Мероприятие не найдено', 'NOT_FOUND', 404);
    }
    throw error;
  }
}

async function assertCanViewEvent(id: string, userId: string): Promise<SchoolEvent> {
  const event = await loadEventOrThrow(id);
  const viewer = await getRequesterUser(userId).catch(() => null);
  if (!canViewSchoolEvent(userId, event, viewer)) {
    throw new ApiError('Нет доступа', 'FORBIDDEN', 403);
  }
  return event;
}

async function maybeUploadEventImage(
  requesterId: string,
  imageUrl: string | undefined,
  contextId?: string,
): Promise<string | undefined> {
  if (!imageUrl) return undefined;
  if (isStoredFileRef(imageUrl) || imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  if (!imageUrl.startsWith('data:')) return imageUrl;

  const mimeMatch = /^data:([^;]+);base64,/.exec(imageUrl);
  const mimeType = mimeMatch?.[1] ?? 'image/jpeg';
  try {
    const uploaded = await uploadStoredFile({
      userId: requesterId,
      purpose: 'event',
      contextId,
      filename: `event-${Date.now()}.jpg`,
      mimeType,
      size: Math.ceil((imageUrl.length * 3) / 4),
      dataUrl: imageUrl,
    });
    return uploaded.url;
  } catch (error) {
    throw mapPocketBaseError(error);
  }
}

function eventToPbBody(input: CreateEventInput, options?: { includeRegistrationReset?: boolean }): Record<string, unknown> {
  const body: Record<string, unknown> = {
    title: input.title,
    description: input.description,
    type: input.type,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime ?? '',
    location: input.location,
    invitedUserIds: input.type === 'invited' ? (input.invitedUserIds ?? []) : [],
  };

  // Только при создании: пустой roster. registeredCount пишет hook sync / миграция —
  // не шлём поле, если миграция ещё не применена (иначе 400 / hook crash).
  if (options?.includeRegistrationReset) {
    body.registeredUserIds = [];
  }

  if (input.imageUrl) body.imageUrl = input.imageUrl;
  else if (input.imageUrl === '') body.imageUrl = '';
  if (input.maxParticipants != null) body.maxParticipants = input.maxParticipants;

  return body;
}

export const pocketbaseEventsApi: EventsApi = {
  async getEvents(userId) {
    return withPbError(async () => {
      const viewer = await getRequesterUser(userId).catch(() => null);
      const pb = getPocketBase();
      const records = await pb.collection('events').getFullList({ sort: 'date,startTime' });
      const events = records
        .map(mapEventRecord)
        .filter((event) => canViewSchoolEvent(userId, event, viewer));
      const ownRegistered = canManageEvents(viewer)
        ? new Set<string>()
        : await loadOwnRegisteredEventIds(userId);
      return Promise.all(
        events.map((event) =>
          presentPbEvent(event, userId, viewer, {
            forceRegistered: ownRegistered.has(event.id),
          }),
        ),
      );
    });
  },

  async getEvent(id, userId) {
    return withPbError(async () => {
      const event = await assertCanViewEvent(id, userId);
      const viewer = await getRequesterUser(userId).catch(() => null);
      const forceRegistered =
        !canManageEvents(viewer) && (await hasOwnRegistration(id, userId));
      return presentPbEvent(event, userId, viewer, { forceRegistered });
    });
  },

  async getRegistration(eventId, userId) {
    return withPbError(async () => {
      await assertCanViewEvent(eventId, userId);
      const pb = getPocketBase();
      try {
        const record = await pb
          .collection('event_registrations')
          .getFirstListItem(`event = "${eventId}" && user = "${userId}"`);
        return mapEventRegistrationRecord(record);
      } catch (error) {
        if (error instanceof ClientResponseError && error.status === 404) return null;
        throw error;
      }
    });
  },

  async getEventParticipants(eventId, requesterId) {
    return withPbError(async () => {
      const viewer = await assertEventsAdminAccess(requesterId);
      const pb = getPocketBase();
      const memberIds = new Set<string>();
      const usersById = new Map<string, User>();

      // Source of truth: registrations (roster JSON may lag / be empty).
      try {
        const regs = await pb.collection('event_registrations').getFullList({
          filter: `event = "${escapePbFilter(eventId)}"`,
          expand: 'user',
        });
        for (const reg of regs) {
          const expanded = (reg as { expand?: { user?: RecordModel | RecordModel[] } }).expand
            ?.user;
          const userRecord = Array.isArray(expanded) ? expanded[0] : expanded;
          if (userRecord && typeof userRecord === 'object' && 'id' in userRecord) {
            const mapped = sanitizeUserPhoneForViewer(mapUserRecord(userRecord), viewer);
            usersById.set(mapped.id, mapped);
            memberIds.add(mapped.id);
            continue;
          }
          const userId = relIdFromPb(reg.get('user'));
          if (userId) memberIds.add(userId);
        }
      } catch {
        /* listRule/migration — fall back to event.registeredUserIds */
      }

      if (memberIds.size === 0) {
        const event = await loadEventOrThrow(eventId);
        for (const id of event.registeredUserIds) {
          if (id) memberIds.add(id);
        }
      }

      const missingIds = [...memberIds].filter((id) => !usersById.has(id));
      if (missingIds.length > 0) {
        const filter = pbEqOr('id', missingIds);
        if (filter) {
          try {
            const records = await pb.collection('users').getFullList({ filter });
            for (const record of records) {
              const mapped = sanitizeUserPhoneForViewer(mapUserRecord(record), viewer);
              usersById.set(mapped.id, mapped);
            }
          } catch {
            for (const userId of missingIds) {
              try {
                const record = await pb.collection('users').getOne(userId);
                const mapped = sanitizeUserPhoneForViewer(mapUserRecord(record), viewer);
                usersById.set(mapped.id, mapped);
              } catch {
                /* skip inaccessible */
              }
            }
          }
        }
      }

      const users = [...memberIds]
        .map((id) => usersById.get(id))
        .filter((u): u is User => !!u);
      return resolveUsersAvatars(users);
    });
  },

  async register(eventId, userId, application) {
    return withPbError(async () => {
      const requester = await getRequesterUser(userId);
      if (!canRegisterForEvents(requester)) {
        throw new ApiError('Запись на мероприятие доступна только ученикам', 'FORBIDDEN', 403);
      }

      const event = await assertCanViewEvent(eventId, userId);
      const taken = getEventRegisteredCount(event);

      if (
        event.maxParticipants &&
        taken >= event.maxParticipants &&
        !event.registeredUserIds.includes(userId) &&
        !event.isRegistered
      ) {
        throw new ApiError('Мест больше нет', 'FULL', 409);
      }

      if (event.type === 'competition') {
        if (!application) {
          throw new ApiError('Заполните заявку на конкурс', 'VALIDATION', 400);
        }
        const validationError = validateCompetitionApplication(application);
        if (validationError) {
          throw new ApiError(validationError, 'VALIDATION', 400);
        }
      }

      const pb = getPocketBase();
      const applicationPayload =
        event.type === 'competition' && application
          ? normalizeCompetitionApplication(application)
          : null;

      try {
        const existing = await pb
          .collection('event_registrations')
          .getFirstListItem(`event = "${eventId}" && user = "${userId}"`);
        if (applicationPayload) {
          await pb.collection('event_registrations').update(existing.id, {
            application: applicationPayload,
          });
        }
      } catch (error) {
        if (!(error instanceof ClientResponseError) || error.status !== 404) {
          throw error;
        }
        try {
          await pb.collection('event_registrations').create({
            event: eventId,
            user: userId,
            application: applicationPayload,
          });
        } catch (createError) {
          const mapped = mapPocketBaseError(createError);
          if (mapped.code === 'FULL') throw mapped;
          if (mapped.code === 'DUPLICATE') {
            return presentPbEvent(await loadEventOrThrow(eventId), userId, requester, {
              forceRegistered: true,
            });
          }
          throw createError;
        }
      }

      return presentPbEvent(await loadEventOrThrow(eventId), userId, requester, {
        forceRegistered: true,
      });
    });
  },

  async unregister(eventId, userId) {
    return withPbError(async () => {
      const requester = await getRequesterUser(userId);
      if (!canRegisterForEvents(requester)) {
        throw new ApiError('Отмена участия доступна только ученикам', 'FORBIDDEN', 403);
      }
      await assertCanViewEvent(eventId, userId);
      const pb = getPocketBase();
      try {
        const existing = await pb
          .collection('event_registrations')
          .getFirstListItem(`event = "${eventId}" && user = "${userId}"`);
        await pb.collection('event_registrations').delete(existing.id);
      } catch (error) {
        if (!(error instanceof ClientResponseError) || error.status !== 404) {
          throw error;
        }
      }
      // Staff notify via pb_hooks onRecordAfterDeleteSuccess
      return presentPbEvent(await loadEventOrThrow(eventId), userId, requester);
    });
  },

  async removeEventParticipant(eventId, participantUserId, requesterId) {
    return withPbError(async () => {
      const viewer = await assertEventsAdminAccess(requesterId);
      await loadEventOrThrow(eventId);
      const pb = getPocketBase();
      try {
        const existing = await pb
          .collection('event_registrations')
          .getFirstListItem(
            `event = "${escapePbFilter(eventId)}" && user = "${escapePbFilter(participantUserId)}"`,
          );
        await pb.collection('event_registrations').delete(existing.id);
      } catch (error) {
        if (!(error instanceof ClientResponseError) || error.status !== 404) {
          throw error;
        }
      }
      // Staff notify via pb_hooks onRecordAfterDeleteSuccess
      return presentPbEvent(await loadEventOrThrow(eventId), requesterId, viewer);
    });
  },

  async getAllEvents(requesterId) {
    return withPbError(async () => {
      await assertEventsAdminAccess(requesterId);
      const pb = getPocketBase();
      const records = await pb.collection('events').getFullList({ sort: 'date,startTime' });
      return Promise.all(records.map((r) => presentPbEvent(mapEventRecord(r), requesterId)));
    });
  },

  async createEvent(input, requesterId) {
    return withPbError(async () => {
      await assertEventsAdminAccess(requesterId);
      const normalized = normalizeEventInput(input) as CreateEventInput;
      const validationError = validateEventInput(normalized);
      if (validationError) {
        throw new ApiError(validationError, 'VALIDATION', 400);
      }

      const imageRef = await maybeUploadEventImage(requesterId, normalized.imageUrl);
      const body = eventToPbBody(
        { ...normalized, imageUrl: imageRef },
        { includeRegistrationReset: true },
      );
      const pb = getPocketBase();
      const record = await pb.collection('events').create(body);
      if (imageRef && isStoredFileRef(imageRef)) {
        const fileId = imageRef.slice('pbfile:'.length);
        try {
          await pb.collection('kvartira_files').update(fileId, { contextId: record.id });
        } catch {
          /* best-effort */
        }
      }
      const created = mapEventRecord(record);
      await notifyStudentsNewEventFromClient(created);
      return presentPbEvent(created, requesterId);
    });
  },

  async updateEvent(id, input: UpdateEventInput, requesterId) {
    return withPbError(async () => {
      await assertEventsAdminAccess(requesterId);
      const event = await loadEventOrThrow(id);

      const imageProvided = Object.prototype.hasOwnProperty.call(input, 'imageUrl');
      const merged: CreateEventInput = {
        title: input.title ?? event.title,
        description: input.description ?? event.description,
        type: input.type ?? event.type,
        date: input.date ?? event.date,
        startTime: input.startTime ?? event.startTime,
        endTime: input.endTime ?? event.endTime,
        location: input.location ?? event.location,
        imageUrl: resolveEventImageWriteInput(
          imageProvided ? input.imageUrl : undefined,
          event.imageUrl,
          imageProvided,
        ),
        maxParticipants: Object.prototype.hasOwnProperty.call(input, 'maxParticipants')
          ? input.maxParticipants
          : event.maxParticipants,
        invitedUserIds: input.invitedUserIds ?? event.invitedUserIds,
      };

      const normalized = normalizeEventInput(merged) as CreateEventInput;
      const validationError = validateEventInput(normalized);
      if (validationError) {
        throw new ApiError(validationError, 'VALIDATION', 400);
      }

      let nextImage = normalized.imageUrl;
      if (imageProvided) {
        if (!normalized.imageUrl) {
          await deleteStoredFiles(event.imageUrl);
          nextImage = undefined;
        } else if (normalized.imageUrl.startsWith('data:')) {
          await deleteStoredFiles(event.imageUrl);
          nextImage = await maybeUploadEventImage(requesterId, normalized.imageUrl, id);
        } else {
          nextImage = await maybeUploadEventImage(requesterId, normalized.imageUrl, id);
        }
      }

      const pb = getPocketBase();
      const body = eventToPbBody({ ...normalized, imageUrl: nextImage });
      if (!nextImage) body.imageUrl = '';
      const record = await pb.collection('events').update(id, body);
      return presentPbEvent(mapEventRecord(record), requesterId);
    });
  },

  async deleteEvent(id, requesterId) {
    return withPbError(async () => {
      await assertEventsAdminAccess(requesterId);
      const event = await loadEventOrThrow(id);
      await deleteStoredFiles(event.imageUrl);
      const pb = getPocketBase();

      // Registrations block delete when cascadeDelete is missing on live DB.
      try {
        const regs = await pb.collection('event_registrations').getFullList({
          filter: `event = "${escapePbFilter(id)}"`,
        });
        await Promise.all(
          regs.map(async (reg) => {
            try {
              await pb.collection('event_registrations').delete(reg.id);
            } catch {
              /* hook purge / cascade */
            }
          }),
        );
      } catch {
        /* list may fail; delete hook still purges */
      }

      await pb.collection('events').delete(id);
    });
  },
};
