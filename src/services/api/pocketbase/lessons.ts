import type {
  CreateDirectionInput,
  LessonsApi,
  UpdateDirectionInput,
} from '@/services/api/types';
import { ApiError } from '@/services/api/types';
import { getPocketBase } from '@/services/api/pocketbase/client';
import { withPbError } from '@/services/api/pocketbase/errors';
import {
  mapDirectionRecord,
  mapLessonHistoryRecord,
  mapLessonRecord,
  mapUserRecord,
} from '@/services/api/pocketbase/mappers';
import { getPocketBaseAvailability } from '@/services/api/pocketbase/availability';
import { resolveUsersAvatars } from '@/services/api/pocketbase/files';
import { canViewLesson, canRescheduleLesson, canCancelLesson, canEditTeacherNotes } from '@/services/lessons/access';
import { sanitizeLessonForViewer } from '@/services/lessons/helpers';
import { calculateAvailableSlots, slotsConflict } from '@/services/slots/calculateSlots';
import { getDayOfWeekFromDate } from '@/utils/dates';
import { canManageDirections } from '@/services/directions/access';
import {
  normalizeDirectionInput,
  validateDirectionInput,
} from '@/services/directions/validation';
import type { Direction, Lesson, LessonHistoryEntry, User } from '@/types';
import { getRequesterUser } from '@/services/api/pocketbase/requester';

function buildLessonsFilter(filters?: {
  studentId?: string;
  teacherId?: string;
  directionId?: string;
  status?: Lesson['status'];
  from?: string;
  to?: string;
}): string | undefined {
  if (!filters) return undefined;

  const parts: string[] = [];
  if (filters.studentId) parts.push(`student = "${filters.studentId}"`);
  if (filters.teacherId) parts.push(`teacher = "${filters.teacherId}"`);
  if (filters.directionId) parts.push(`direction = "${filters.directionId}"`);
  if (filters.status) parts.push(`status = "${filters.status}"`);
  if (filters.from) parts.push(`date >= "${filters.from}"`);
  if (filters.to) parts.push(`date <= "${filters.to}"`);

  return parts.length > 0 ? parts.join(' && ') : undefined;
}

function applyLessonTimeFilters(
  lessons: Lesson[],
  filters?: { upcoming?: boolean; past?: boolean },
): Lesson[] {
  if (!filters?.upcoming && !filters?.past) return lessons;

  const now = new Date();
  return lessons.filter((lesson) => {
    const lessonDate = new Date(`${lesson.date}T${lesson.startTime}`);
    if (
      filters.upcoming &&
      lessonDate < now &&
      lesson.status !== 'scheduled' &&
      lesson.status !== 'confirmed'
    ) {
      return false;
    }
    if (
      filters.past &&
      lessonDate >= now &&
      lesson.status !== 'completed' &&
      lesson.status !== 'cancelled'
    ) {
      return false;
    }
    return true;
  });
}

async function assertLessonAccess(lesson: Lesson, userId: string): Promise<User> {

  const user = await getRequesterUser(userId);

  if (!canViewLesson(user, lesson)) {

    throw new ApiError('Нет доступа к занятию', 'FORBIDDEN', 403);

  }

  return user;

}



async function createHistoryEntry(

  lessonId: string,

  action: LessonHistoryEntry['action'],

  userId: string,

  fields: Partial<LessonHistoryEntry> = {},

): Promise<void> {

  const pb = getPocketBase();

  await pb.collection('lesson_history').create({

    lesson: lessonId,

    action,

    user: userId,

    previousDate: fields.previousDate ?? '',

    previousStartTime: fields.previousStartTime ?? '',

    newDate: fields.newDate ?? '',

    newStartTime: fields.newStartTime ?? '',

    reason: fields.reason ?? '',

  });

}



async function loadTeacherLessons(teacherId: string): Promise<Lesson[]> {

  const pb = getPocketBase();

  const records = await pb.collection('lessons').getFullList({

    filter: `teacher = "${teacherId}"`,

    sort: 'date,startTime',

  });

  return records.map(mapLessonRecord);

}



export const pocketbaseLessonsApi: LessonsApi = {

  async getDirections() {
    return withPbError(async () => {
      const pb = getPocketBase();
      const records = await pb.collection('directions').getFullList({ sort: 'name' });
      return records.map(mapDirectionRecord);
    });
  },

  async createDirection(input: CreateDirectionInput, adminId) {
    return withPbError(async () => {
      const pb = getPocketBase();
      const admin = mapUserRecord(await pb.collection('users').getOne(adminId));
      if (!canManageDirections(admin)) {
        throw new ApiError('Нет доступа', 'FORBIDDEN', 403);
      }
      const validationError = validateDirectionInput(input);
      if (validationError) {
        throw new ApiError(validationError, 'VALIDATION_ERROR', 400);
      }
      const normalized = normalizeDirectionInput(input);
      const record = await pb.collection('directions').create(normalized);
      return mapDirectionRecord(record);
    });
  },

  async updateDirection(id: string, input: UpdateDirectionInput, adminId) {
    return withPbError(async () => {
      const pb = getPocketBase();
      const admin = mapUserRecord(await pb.collection('users').getOne(adminId));
      if (!canManageDirections(admin)) {
        throw new ApiError('Нет доступа', 'FORBIDDEN', 403);
      }
      const current = mapDirectionRecord(await pb.collection('directions').getOne(id));
      const next: Direction = {
        ...current,
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
      };
      const validationError = validateDirectionInput(next);
      if (validationError) {
        throw new ApiError(validationError, 'VALIDATION_ERROR', 400);
      }
      const normalized = normalizeDirectionInput(next);
      const record = await pb.collection('directions').update(id, {
        name: normalized.name,
        description: normalized.description ?? '',
        icon: normalized.icon ?? '',
      });
      return mapDirectionRecord(record);
    });
  },

  async deleteDirection(id: string, adminId) {
    return withPbError(async () => {
      const pb = getPocketBase();
      const admin = mapUserRecord(await pb.collection('users').getOne(adminId));
      if (!canManageDirections(admin)) {
        throw new ApiError('Нет доступа', 'FORBIDDEN', 403);
      }
      const lessons = await pb.collection('lessons').getList(1, 1, {
        filter: `direction = "${id}"`,
      });
      if (lessons.totalItems > 0) {
        throw new ApiError('Нельзя удалить направление: есть занятия', 'CONFLICT', 409);
      }
      const users = await pb.collection('users').getFullList({ fields: 'id,directionIds' });
      const assigned = users.some((u) => {
        const ids = (u as { directionIds?: string[] }).directionIds ?? [];
        return ids.includes(id);
      });
      if (assigned) {
        throw new ApiError(
          'Нельзя удалить направление: оно назначено пользователям',
          'CONFLICT',
          409,
        );
      }
      await pb.collection('directions').delete(id);
    });
  },

  async getTeachers(directionId) {

    return withPbError(async () => {

      const pb = getPocketBase();

      const records = await pb.collection('users').getFullList({

        filter: 'role = "teacher"',

        sort: 'firstName',

      });



      const filtered = directionId

        ? records.filter((record) => {

            const directionIds = (record.directionIds as string[] | undefined) ?? [];

            return directionIds.includes(directionId);

          })

        : records;



      const users = await resolveUsersAvatars(filtered.map((record) => mapUserRecord(record)));
      return users.map((user) => ({ ...user, phone: '' }));

    });

  },



  async getLessons(filters) {

    return withPbError(async () => {

      const pb = getPocketBase();

      const filter = buildLessonsFilter(filters);

      const records = await pb.collection('lessons').getFullList({

        filter,

        sort: 'date,startTime',

      });



      let lessons = records.map(mapLessonRecord);



      if (filters?.requesterId) {

        const requester = await getRequesterUser(filters.requesterId);

        lessons = lessons.filter((lesson) => canViewLesson(requester, lesson));

      }



      return applyLessonTimeFilters(lessons, filters);

    });

  },



  async getLesson(id, userId) {

    return withPbError(async () => {

      const pb = getPocketBase();

      const record = await pb.collection('lessons').getOne(id);

      const lesson = mapLessonRecord(record);

      const user = await assertLessonAccess(lesson, userId);

      return sanitizeLessonForViewer(lesson, user);

    });

  },



  async getAvailableSlots({ teacherId, date, durationMinutes, excludeLessonId }) {

    return withPbError(async () => {

      const availability = await getPocketBaseAvailability(teacherId);

      if (!availability) return [];



      const existingLessons = await loadTeacherLessons(teacherId);



      return calculateAvailableSlots({

        availability,

        existingLessons,

        date,

        dayOfWeek: getDayOfWeekFromDate(date),

        lessonDurationMinutes:

          durationMinutes ?? availability.defaultLessonDurationMinutes,

        excludeLessonId,

      });

    });

  },



  async bookLesson(input, studentId) {
    return withPbError(async () => {
      const [availability, existingLessons] = await Promise.all([
        getPocketBaseAvailability(input.teacherId),
        loadTeacherLessons(input.teacherId),
      ]);
      if (!availability) {
        throw new ApiError('Преподаватель недоступен', 'NOT_FOUND', 404);
      }

      const duration = input.durationMinutes ?? availability.defaultLessonDurationMinutes;
      const slots = calculateAvailableSlots({
        availability,
        existingLessons,
        date: input.date,
        dayOfWeek: getDayOfWeekFromDate(input.date),
        lessonDurationMinutes: duration,
      });

      if (!slots.some((slot) => slot.startTime === input.startTime)) {
        throw new ApiError(
          'Этот слот уже занят. Выберите другое время.',
          'SLOT_UNAVAILABLE',
          409,
        );
      }

      if (
        slotsConflict(
          existingLessons,
          input.teacherId,
          input.date,
          input.startTime,
          duration,
        )
      ) {
        throw new ApiError(
          'Этот слот уже занят. Выберите другое время.',
          'SLOT_CONFLICT',
          409,
        );
      }

      const pb = getPocketBase();
      const record = await pb.collection('lessons').create({
        student: studentId,
        teacher: input.teacherId,
        direction: input.directionId,
        date: input.date,
        startTime: input.startTime,
        durationMinutes: duration,
        status: 'scheduled',
        location: 'Студия',
        materials: [],
        teacherNotes: '',
        cancelReason: '',
      });

      const lesson = mapLessonRecord(record);

      await createHistoryEntry(lesson.id, 'created', studentId, {
        newDate: lesson.date,
        newStartTime: lesson.startTime,
      });

      return lesson;
    });
  },

  async rescheduleLesson(id, input, userId) {
    return withPbError(async () => {
      const pb = getPocketBase();
      const [existing, user] = await Promise.all([
        pb.collection('lessons').getOne(id),
        getRequesterUser(userId),
      ]);
      const lesson = mapLessonRecord(existing);

      if (!canRescheduleLesson(user, lesson)) {
        throw new ApiError('Нет прав на перенос занятия', 'FORBIDDEN', 403);
      }

      if (lesson.status === 'cancelled' || lesson.status === 'completed') {
        throw new ApiError('Нельзя перенести это занятие', 'INVALID_STATUS', 400);
      }

      const [availability, existingLessons] = await Promise.all([
        getPocketBaseAvailability(lesson.teacherId),
        loadTeacherLessons(lesson.teacherId),
      ]);
      if (!availability) {
        throw new ApiError('Преподаватель недоступен', 'NOT_FOUND', 404);
      }

      const slots = calculateAvailableSlots({
        availability,
        existingLessons,
        date: input.date,
        dayOfWeek: getDayOfWeekFromDate(input.date),
        lessonDurationMinutes: lesson.durationMinutes,
        excludeLessonId: id,
      });

      if (!slots.some((slot) => slot.startTime === input.startTime)) {
        throw new ApiError(
          'Это время больше недоступно. Выберите другое.',
          'SLOT_UNAVAILABLE',
          409,
        );
      }

      if (
        slotsConflict(
          existingLessons,
          lesson.teacherId,
          input.date,
          input.startTime,
          lesson.durationMinutes,
          id,
        )
      ) {
        throw new ApiError(
          'Это время больше недоступно. Выберите другое.',
          'SLOT_CONFLICT',
          409,
        );
      }

      const prevDate = lesson.date;
      const prevTime = lesson.startTime;

      const record = await pb.collection('lessons').update(id, {
        date: input.date,
        startTime: input.startTime,
        status: 'rescheduled',
      });

      const updated = mapLessonRecord(record);

      await createHistoryEntry(id, 'rescheduled', userId, {
        previousDate: prevDate,
        previousStartTime: prevTime,
        newDate: input.date,
        newStartTime: input.startTime,
      });

      return updated;
    });
  },

  async cancelLesson(id, userId, reason) {

    return withPbError(async () => {

      const pb = getPocketBase();

      const existing = await pb.collection('lessons').getOne(id);

      const lesson = mapLessonRecord(existing);

      const user = await getRequesterUser(userId);



      if (!canCancelLesson(user, lesson)) {

        throw new ApiError('Нет прав на отмену занятия', 'FORBIDDEN', 403);

      }



      if (lesson.status === 'cancelled') {

        throw new ApiError('Занятие уже отменено', 'ALREADY_CANCELLED', 400);

      }



      const record = await pb.collection('lessons').update(id, {

        status: 'cancelled',

        cancelReason: reason ?? '',

      });



      const cancelled = mapLessonRecord(record);



      await createHistoryEntry(id, 'cancelled', userId, { reason });



      return cancelled;

    });

  },



  async getLessonHistory(lessonId, userId) {

    return withPbError(async () => {

      const pb = getPocketBase();

      const lessonRecord = await pb.collection('lessons').getOne(lessonId);

      const lesson = mapLessonRecord(lessonRecord);

      await assertLessonAccess(lesson, userId);



      const records = await pb.collection('lesson_history').getFullList({

        filter: `lesson = "${lessonId}"`,

        sort: '-id',

      });



      return records.map(mapLessonHistoryRecord);

    });

  },



  async updateTeacherNotes(id, notes, userId) {

    return withPbError(async () => {

      const pb = getPocketBase();

      const existing = await pb.collection('lessons').getOne(id);

      const lesson = mapLessonRecord(existing);

      const user = await getRequesterUser(userId);



      if (!canEditTeacherNotes(user, lesson)) {

        throw new ApiError('Нет прав на редактирование заметок', 'FORBIDDEN', 403);

      }



      const record = await pb.collection('lessons').update(id, {

        teacherNotes: notes.trim() || '',

      });



      return mapLessonRecord(record);

    });

  },

};


