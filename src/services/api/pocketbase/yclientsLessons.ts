import type { LessonsApi } from '@/services/api/types';
import { ApiError } from '@/services/api/types';
import type { BookLessonInput } from '@/types';
import { getRequesterUser } from '@/services/api/pocketbase/requester';
import { useAuthStore } from '@/stores/authStore';
import { getYclientsApi } from '@/services/api/yclientsClient';
import {
  findDirectionIdForService,
  mapStaffToTeacherUser,
  mapYclientsRecordToLesson,
  mapYclientsSlotToTimeSlot,
  requireMappedService,
} from '@/services/yclients/mappers';
import {
  normalizeYclientsMappings,
  resolveServiceIdForDirection,
} from '@/services/yclients/mapping';
import {
  isYclientsLessonId,
  parseYclientsLessonId,
  resolveBookingStaffId,
} from '@/services/yclients/ids';
import type { Lesson, TimeSlot, User } from '@/types';
import { canViewLesson, canCancelLesson } from '@/services/lessons/access';
import { sanitizeLessonForViewer } from '@/services/lessons/helpers';
import { getPocketBase } from '@/services/api/pocketbase/client';
import { mapUserRecord } from '@/services/api/pocketbase/mappers';
import { resolveUsersAvatars } from '@/services/api/pocketbase/files';
import { normalizeLessonDate } from '@/utils/dates';
import { format, parseISO, addDays } from 'date-fns';

const ycApi = () => getYclientsApi();

/** YCLIENTS `end_date` is often exclusive — widen single-day requests by +1 day. */
function yclientsRecordsRange(from?: string, to?: string): { from?: string; to?: string } {
  const f = from ? normalizeLessonDate(from) : '';
  const t = to ? normalizeLessonDate(to) : '';
  if (!f && !t) return {};
  if (f && t && f === t) {
    return { from: f, to: format(addDays(parseISO(f), 1), 'yyyy-MM-dd') };
  }
  if (f && t) {
    // Inclusive app range → exclusive-leaning API: extend end by 1 day
    return { from: f, to: format(addDays(parseISO(t), 1), 'yyyy-MM-dd') };
  }
  return { from: f || undefined, to: t || undefined };
}

async function loadMappings() {
  return ycApi().getMappings();
}

async function loadMappedUsers(mappings: Awaited<ReturnType<typeof loadMappings>>): Promise<Map<string, User>> {
  const ids = [...new Set(Object.values(mappings.staffToUserId))];
  if (ids.length === 0) return new Map();
  const pb = getPocketBase();
  const users: User[] = [];
  await Promise.all(
    ids.map(async (id) => {
      try {
        const record = await pb.collection('users').getOne(id);
        users.push(mapUserRecord(record));
      } catch {
        /* skip missing */
      }
    }),
  );
  const withAvatars = await resolveUsersAvatars(users);
  return new Map(withAvatars.map((u) => [u.id, u]));
}

function currentUserId(): string {
  const id = useAuthStore.getState().session?.user?.id;
  if (!id) throw new ApiError('Нужна авторизация', 'UNAUTHORIZED', 401);
  return id;
}

/**
 * LessonsApi backed by YCLIENTS for schedule / book / cancel.
 * Directions CRUD stays on the PocketBase lessons adapter.
 */
export function createYclientsLessonsApi(base: LessonsApi): LessonsApi {
  return {
    getDirections: (...args) => base.getDirections(...args),
    createDirection: (...args) => base.createDirection(...args),
    updateDirection: (...args) => base.updateDirection(...args),
    deleteDirection: (...args) => base.deleteDirection(...args),
    getLessonHistory: async () => [],
    updateTeacherNotes: async () => {
      throw new ApiError('Заметки преподавателя недоступны в режиме YCLIENTS', 'NOT_IMPLEMENTED', 501);
    },

    async getTeachers(directionId?: string): Promise<User[]> {
      const mappings = await loadMappings();
      const serviceId = directionId
        ? resolveServiceIdForDirection(mappings, directionId)
        : null;
      if (directionId && !serviceId) return [];
      const staff = await ycApi().getStaff(serviceId ?? undefined);
      const usersById = await loadMappedUsers(mappings);
      return staff.filter((s) => s.bookable).map((s) => mapStaffToTeacherUser(s, mappings, usersById));
    },

    async getAvailableSlots(params): Promise<TimeSlot[]> {
      const mappings = await loadMappings();
      const staffId = resolveBookingStaffId(params.teacherId, mappings.staffToUserId);
      if (!staffId) {
        throw new ApiError('Преподаватель не связан с сотрудником YCLIENTS', 'VALIDATION', 400);
      }
      const slots = await ycApi().getSlots({
        staffId,
        date: params.date,
      });
      return slots.map(mapYclientsSlotToTimeSlot);
    },

    async bookLesson(input: BookLessonInput, studentId: string): Promise<Lesson> {
      const mappings = await loadMappings();
      const serviceId = requireMappedService(mappings, input.directionId);
      const staffId = resolveBookingStaffId(input.teacherId, mappings.staffToUserId);
      if (!staffId) {
        throw new ApiError('Преподаватель не связан с сотрудником YCLIENTS', 'VALIDATION', 400);
      }
      const student = await getRequesterUser(studentId);
      const datetime = `${input.date} ${input.startTime}:00`;
      const record = await ycApi().book({
        staffId,
        serviceId,
        datetime,
        studentPhone: student.phone,
        studentName: `${student.firstName} ${student.lastName}`.trim(),
      });
      return mapYclientsRecordToLesson(record, mappings, {
        studentUserId: studentId,
        directionId: input.directionId,
      });
    },

    async rescheduleLesson(): Promise<Lesson> {
      throw new ApiError(
        'Перенос через YCLIENTS в v1 отключён — отмените занятие и запишитесь заново',
        'NOT_IMPLEMENTED',
        501,
      );
    },

    async cancelLesson(id: string, userId: string): Promise<Lesson> {
      const recordId = parseYclientsLessonId(id);
      if (!recordId) {
        throw new ApiError('Некорректный id занятия YCLIENTS', 'VALIDATION', 400);
      }
      const user = await getRequesterUser(userId);
      const mappings = await loadMappings().catch(() => normalizeYclientsMappings(null));
      const record = await ycApi().getRecord(recordId);
      const lesson = mapYclientsRecordToLesson(record, mappings, {
        studentUserId: user.role === 'student' ? user.id : '',
        directionId: findDirectionIdForService(mappings, record.services[0]?.id ?? 0) ?? '',
      });
      if (user.role === 'student') lesson.studentId = user.id;

      const viewable = { ...lesson, studentId: lesson.studentId || user.id };
      if (!canCancelLesson(user, viewable) && user.role !== 'admin') {
        throw new ApiError('Нет доступа', 'FORBIDDEN', 403);
      }
      await ycApi().cancel(recordId);
      return { ...viewable, status: 'cancelled', updatedAt: new Date().toISOString() };
    },

    async getLesson(id: string, userId: string): Promise<Lesson> {
      if (!isYclientsLessonId(id)) {
        return base.getLesson(id, userId);
      }
      const recordId = parseYclientsLessonId(id)!;
      const user = await getRequesterUser(userId);
      const mappings = await loadMappings().catch(() => normalizeYclientsMappings(null));
      const record = await ycApi().getRecord(recordId);
      const lesson = mapYclientsRecordToLesson(record, mappings, {
        studentUserId: user.role === 'student' ? user.id : '',
        directionId: findDirectionIdForService(mappings, record.services[0]?.id ?? 0) ?? '',
      });
      if (user.role === 'student') lesson.studentId = user.id;
      const forAccess = { ...lesson, studentId: lesson.studentId || user.id };
      if (!canViewLesson(user, forAccess)) {
        throw new ApiError('Нет доступа', 'FORBIDDEN', 403);
      }
      return sanitizeLessonForViewer(forAccess, user);
    },

    async getLessons(filters): Promise<Lesson[]> {
      const requesterId = filters?.requesterId ?? currentUserId();
      const user = await getRequesterUser(requesterId);
      const mappings = await loadMappings().catch(() => normalizeYclientsMappings(null));
      const staffFilter = filters?.teacherId
        ? resolveBookingStaffId(filters.teacherId, mappings.staffToUserId)
        : null;
      const apiRange = yclientsRecordsRange(filters?.from, filters?.to);
      const records = await ycApi().getRecords({
        from: apiRange.from,
        to: apiRange.to,
        staffId: staffFilter ?? undefined,
      });

      const from = filters?.from ? normalizeLessonDate(filters.from) : '';
      const to = filters?.to ? normalizeLessonDate(filters.to) : '';

      return records
        .map((record) => {
          const directionId =
            findDirectionIdForService(mappings, record.services[0]?.id ?? 0) ?? '';
          const lesson = mapYclientsRecordToLesson(record, mappings, {
            studentUserId: user.role === 'student' ? user.id : filters?.studentId || '',
            directionId,
          });
          if (user.role === 'student') lesson.studentId = user.id;
          lesson.date = normalizeLessonDate(lesson.date) || lesson.date;
          return lesson;
        })
        .filter((lesson) => {
          const date = normalizeLessonDate(lesson.date);
          if (from && date && date < from) return false;
          if (to && date && date > to) return false;
          if (filters?.directionId && lesson.directionId !== filters.directionId) return false;
          if (filters?.status && lesson.status !== filters.status) return false;
          const forAccess = {
            ...lesson,
            studentId: lesson.studentId || (user.role === 'student' ? user.id : lesson.studentId),
          };
          return canViewLesson(user, forAccess);
        });
    },
  };
}
