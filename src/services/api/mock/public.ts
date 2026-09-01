import type { PublicApi } from '@/services/api/types';
import { ApiError } from '@/services/api/types';
import {
  directions,
  publicNews,
  teacherDirections,
} from '@/mocks/seed';
import { filterPublicEvents, toPublicTeacher } from '@/services/public/helpers';
import type { SchoolEvent, User, PublicSchoolInfo } from '@/types';

export interface MockPublicDb {
  users: User[];
  events: SchoolEvent[];
  schoolInfo: PublicSchoolInfo;
}

function getPublicTeachers(db: MockPublicDb) {
  return db.users
    .filter((u) => u.role === 'teacher')
    .map((u) => toPublicTeacher(u, teacherDirections[u.id] ?? [], directions));
}

export function createMockPublicApi(db: MockPublicDb, delay: (ms?: number) => Promise<void>): PublicApi {
  return {
    async getLandingData() {
      await delay();
      return {
        school: structuredClone(db.schoolInfo),
        directions,
        teachers: getPublicTeachers(db),
        events: filterPublicEvents(db.events),
        news: publicNews,
      };
    },

    async getDirection(id) {
      await delay();
      const direction = directions.find((d) => d.id === id);
      if (!direction) {
        throw new ApiError('Направление не найдено', 'NOT_FOUND', 404);
      }

      const teachers = getPublicTeachers(db).filter((t) =>
        t.directions.some((d) => d.id === id),
      );

      return { ...direction, teachers };
    },

    async getTeacher(id) {
      await delay();
      const user = db.users.find((u) => u.id === id && u.role === 'teacher');
      if (!user) {
        throw new ApiError('Преподаватель не найден', 'NOT_FOUND', 404);
      }
      return toPublicTeacher(user, teacherDirections[user.id] ?? [], directions);
    },
  };
}
