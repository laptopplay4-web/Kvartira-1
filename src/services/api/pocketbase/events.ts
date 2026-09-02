import { ClientResponseError } from 'pocketbase';
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
import { canManageEvents, canViewSchoolEvent } from '@/services/events/access';
import {
  normalizeCompetitionApplication,
  normalizeEventInput,
  validateCompetitionApplication,
  validateEventInput,
} from '@/services/events/validation';
import type { SchoolEvent, User } from '@/types';

async function getRequesterUser(requesterId: string): Promise<User> {
  const pb = getPocketBase();
  const record = await pb.collection('users').getOne(requesterId);
  return mapUserRecord(record);
}

async function assertEventsAdminAccess(requesterId: string): Promise<User> {
  const user = await getRequesterUser(requesterId);
  if (!canManageEvents(user)) {
    throw new ApiError('Нет доступа', 'FORBIDDEN', 403);
  }
  return user;
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
  if (!canViewSchoolEvent(userId, event)) {
    throw new ApiError('Нет доступа', 'FORBIDDEN', 403);
  }
  return event;
}

function eventToPbBody(input: CreateEventInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    title: input.title,
    description: input.description,
    type: input.type,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime ?? '',
    location: input.location,
    registeredUserIds: [],
    invitedUserIds: input.type === 'invited' ? (input.invitedUserIds ?? []) : [],
  };

  if (input.imageUrl) body.imageUrl = input.imageUrl;
  if (input.maxParticipants != null) body.maxParticipants = input.maxParticipants;

  return body;
}

export const pocketbaseEventsApi: EventsApi = {
  async getEvents(userId) {
    return withPbError(async () => {
      const pb = getPocketBase();
      const records = await pb.collection('events').getFullList({ sort: 'date,startTime' });
      return records.map(mapEventRecord).filter((event) => canViewSchoolEvent(userId, event));
    });
  },

  async getEvent(id, userId) {
    return withPbError(async () => assertCanViewEvent(id, userId));
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

  async register(eventId, userId, application) {
    return withPbError(async () => {
      const event = await assertCanViewEvent(eventId, userId);

      if (
        event.maxParticipants &&
        event.registeredUserIds.length >= event.maxParticipants &&
        !event.registeredUserIds.includes(userId)
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
          if (mapped.code === 'DUPLICATE') return loadEventOrThrow(eventId);
          throw createError;
        }
      }

      return loadEventOrThrow(eventId);
    });
  },

  async unregister(eventId, userId) {
    return withPbError(async () => {
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
      return loadEventOrThrow(eventId);
    });
  },

  async getAllEvents(requesterId) {
    return withPbError(async () => {
      await assertEventsAdminAccess(requesterId);
      const pb = getPocketBase();
      const records = await pb.collection('events').getFullList({ sort: 'date,startTime' });
      return records.map(mapEventRecord);
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

      const pb = getPocketBase();
      const record = await pb.collection('events').create(eventToPbBody(normalized));
      return mapEventRecord(record);
    });
  },

  async updateEvent(id, input: UpdateEventInput, requesterId) {
    return withPbError(async () => {
      await assertEventsAdminAccess(requesterId);
      const event = await loadEventOrThrow(id);

      const merged: CreateEventInput = {
        title: input.title ?? event.title,
        description: input.description ?? event.description,
        type: input.type ?? event.type,
        date: input.date ?? event.date,
        startTime: input.startTime ?? event.startTime,
        endTime: input.endTime ?? event.endTime,
        location: input.location ?? event.location,
        imageUrl: input.imageUrl ?? event.imageUrl,
        maxParticipants: input.maxParticipants ?? event.maxParticipants,
        invitedUserIds: input.invitedUserIds ?? event.invitedUserIds,
      };

      const normalized = normalizeEventInput(merged) as CreateEventInput;
      const validationError = validateEventInput(normalized);
      if (validationError) {
        throw new ApiError(validationError, 'VALIDATION', 400);
      }

      const pb = getPocketBase();
      const body = eventToPbBody(normalized);
      delete body.registeredUserIds;
      const record = await pb.collection('events').update(id, body);
      return mapEventRecord(record);
    });
  },

  async deleteEvent(id, requesterId) {
    return withPbError(async () => {
      await assertEventsAdminAccess(requesterId);
      await loadEventOrThrow(id);
      const pb = getPocketBase();
      await pb.collection('events').delete(id);
    });
  },
};
