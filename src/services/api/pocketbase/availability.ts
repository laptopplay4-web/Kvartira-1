import type { AvailabilityApi, UpdateTeacherAvailabilityInput } from '@/services/api/types';
import { ApiError } from '@/services/api/types';
import { actsAsTeacher, can } from '@/permissions';
import { getPocketBase } from '@/services/api/pocketbase/client';
import { withPbError } from '@/services/api/pocketbase/errors';
import { mapAvailabilityRecord, mapUserRecord } from '@/services/api/pocketbase/mappers';
import { validateTeacherAvailability } from '@/services/availability/validateAvailability';
import type { TeacherAvailability } from '@/types';

async function assertAvailabilityAccess(teacherId: string, requesterId: string): Promise<void> {
  const pb = getPocketBase();
  const requesterRecord = await pb.collection('users').getOne(requesterId);
  const requester = mapUserRecord(requesterRecord);

  if (!can(requester, 'availability:manage')) {
    throw new ApiError('Нет доступа к графику работы', 'FORBIDDEN', 403);
  }

  if (requester.role === 'teacher' && requester.id !== teacherId) {
    throw new ApiError('Нет доступа к графику работы', 'FORBIDDEN', 403);
  }
}

function availabilityBody(
  teacherId: string,
  data: UpdateTeacherAvailabilityInput,
  existing?: TeacherAvailability | null,
) {
  return {
    teacher: teacherId,
    slotIntervalMinutes: data.slotIntervalMinutes,
    defaultLessonDurationMinutes:
      data.defaultLessonDurationMinutes ??
      existing?.defaultLessonDurationMinutes ??
      60,
    schedule: data.schedule,
    exceptions: data.exceptions !== undefined ? data.exceptions : existing?.exceptions ?? [],
    planningPeriod:
      data.planningPeriod !== undefined
        ? data.planningPeriod ?? null
        : existing?.planningPeriod ?? null,
  };
}

/** Internal helper for lessons adapter slot calculation (no requester guard). */
export async function getPocketBaseAvailability(teacherId: string): Promise<TeacherAvailability | null> {
  const pb = getPocketBase();
  try {
    const record = await pb
      .collection('teacher_availability')
      .getFirstListItem(`teacher = "${teacherId}"`);
    return mapAvailabilityRecord(record);
  } catch {
    return null;
  }
}

export const pocketbaseAvailabilityApi: AvailabilityApi = {
  async getTeacherAvailability(teacherId, requesterId) {
    return withPbError(async () => {
      await assertAvailabilityAccess(teacherId, requesterId);
      return getPocketBaseAvailability(teacherId);
    });
  },

  async updateTeacherAvailability(teacherId, data, requesterId) {
    return withPbError(async () => {
      await assertAvailabilityAccess(teacherId, requesterId);

      const errors = validateTeacherAvailability(data);
      if (errors.length > 0) {
        throw new ApiError(errors[0]!.message, 'VALIDATION_ERROR', 400);
      }

      const pb = getPocketBase();
      const teacherRecord = await pb.collection('users').getOne(teacherId);
      const teacher = mapUserRecord(teacherRecord);
      if (!actsAsTeacher(teacher.role)) {
        throw new ApiError('Пользователь не является преподавателем', 'INVALID_USER', 400);
      }

      const existing = await getPocketBaseAvailability(teacherId);
      const body = availabilityBody(teacherId, data, existing);

      if (existing) {
        const existingRecord = await pb
          .collection('teacher_availability')
          .getFirstListItem(`teacher = "${teacherId}"`);
        const record = await pb.collection('teacher_availability').update(existingRecord.id, body);
        return mapAvailabilityRecord(record);
      }

      const record = await pb.collection('teacher_availability').create(body);
      return mapAvailabilityRecord(record);
    });
  },
};
