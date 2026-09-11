import { ClientResponseError } from 'pocketbase';
import type { PublicApi } from '@/services/api/types';
import { ApiError } from '@/services/api/types';
import { publicSchoolInfo as defaultSchoolInfo } from '@/mocks/seed';
import { getPocketBase } from '@/services/api/pocketbase/client';
import { withPbError } from '@/services/api/pocketbase/errors';
import {
  mapDirectionRecord,
  mapEventRecord,
  mapPublicNewsRecord,
  mapSchoolSettingsRecord,
  mapUserRecord,
} from '@/services/api/pocketbase/mappers';
import { resolveStoredFileUrl, resolveUsersAvatars } from '@/services/api/pocketbase/files';
import { filterPublicEvents, toPublicTeacher } from '@/services/public/helpers';
import type { Direction, PublicTeacher, User } from '@/types';

async function loadSchool() {
  const pb = getPocketBase();
  try {
    const records = await pb.collection('school_settings').getList(1, 1, { sort: '-id' });
    if (records.items[0]) {
      const school = mapSchoolSettingsRecord(records.items[0]);
      if (school.directionsVideo?.url) {
        const url = await resolveStoredFileUrl(school.directionsVideo.url);
        if (url) school.directionsVideo = { ...school.directionsVideo, url };
      }
      return school;
    }
  } catch {
    /* empty or unavailable */
  }
  return structuredClone(defaultSchoolInfo);
}

async function loadDirections(): Promise<Direction[]> {
  const pb = getPocketBase();
  const records = await pb.collection('directions').getFullList({ sort: 'name' });
  return records.map(mapDirectionRecord);
}

async function loadTeachers(directions: Direction[]): Promise<PublicTeacher[]> {
  const pb = getPocketBase();
  const records = await pb.collection('users').getFullList({
    filter: 'role = "teacher"',
    sort: 'firstName',
  });
  const teachers = await resolveUsersAvatars(
    records.map((record) => mapUserRecord(record)).filter((user) => user.role === 'teacher'),
  );
  return teachers.map((user) => toPublicTeacher(user, user.directionIds ?? [], directions));
}

export const pocketbasePublicApi: PublicApi = {
  async getLandingData() {
    return withPbError(async () => {
      const pb = getPocketBase();
      const [school, directions, eventsRecords, newsRecords] = await Promise.all([
        loadSchool(),
        loadDirections(),
        pb.collection('events').getFullList({ sort: 'date,startTime' }),
        pb.collection('public_news').getFullList({ sort: '-publishedAt' }),
      ]);
      const teachers = await loadTeachers(directions);
      const events = filterPublicEvents(eventsRecords.map(mapEventRecord));
      const news = newsRecords.map(mapPublicNewsRecord);

      return { school, directions, teachers, events, news };
    });
  },

  async getDirection(id) {
    return withPbError(async () => {
      const pb = getPocketBase();
      let direction: Direction;
      try {
        direction = mapDirectionRecord(await pb.collection('directions').getOne(id));
      } catch (error) {
        if (error instanceof ClientResponseError && error.status === 404) {
          throw new ApiError('Направление не найдено', 'NOT_FOUND', 404);
        }
        throw error;
      }

      const directions = await loadDirections();
      const teachers = (await loadTeachers(directions)).filter((t) =>
        t.directions.some((d) => d.id === id),
      );
      return { ...direction, teachers };
    });
  },

  async getTeacher(id) {
    return withPbError(async () => {
      const pb = getPocketBase();
      let user: User;
      try {
        user = mapUserRecord(await pb.collection('users').getOne(id));
      } catch (error) {
        if (error instanceof ClientResponseError && error.status === 404) {
          throw new ApiError('Преподаватель не найден', 'NOT_FOUND', 404);
        }
        throw error;
      }
      if (user.role !== 'teacher') {
        throw new ApiError('Преподаватель не найден', 'NOT_FOUND', 404);
      }
      const directions = await loadDirections();
      const [resolved] = await resolveUsersAvatars([user]);
      return toPublicTeacher(resolved, resolved.directionIds ?? [], directions);
    });
  },
};
