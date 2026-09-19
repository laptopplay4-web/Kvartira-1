import type { Lesson, LessonStatus, TimeSlot, User } from '@/types';
import { toYclientsLessonId, toYclientsStaffUserId } from '@/services/yclients/ids';
import type {
  YclientsMappings,
  YclientsRecordDto,
  YclientsStaffDto,
  YclientsTimeSlotDto,
} from '@/services/yclients/types';
import { resolveServiceIdForDirection, resolveUserIdForStaff } from '@/services/yclients/mapping';
import { ApiError } from '@/services/api/types';

/** Soft link: UI name/avatar from PWA; YC only for schedule identity. */
export function mapStaffToTeacherUser(
  staff: YclientsStaffDto,
  mappings: YclientsMappings,
  usersById: Map<string, User>,
): User {
  const mappedId = resolveUserIdForStaff(mappings, staff.id);
  if (mappedId && usersById.has(mappedId)) {
    return usersById.get(mappedId)!;
  }

  const parts = staff.name.trim().split(/\s+/);
  const firstName = parts[0] || staff.name || 'Мастер';
  const lastName = parts.slice(1).join(' ') || '';

  return {
    id: toYclientsStaffUserId(staff.id),
    phone: '',
    role: 'teacher',
    firstName,
    lastName,
    avatarUrl: staff.avatarUrl,
    bio: staff.specialization,
  };
}

export function mapYclientsSlotToTimeSlot(slot: YclientsTimeSlotDto): TimeSlot {
  return {
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
  };
}

function attendanceToStatus(attendance: number | undefined, deleted: boolean): LessonStatus {
  if (deleted) return 'cancelled';
  if (attendance === 2) return 'no_show';
  if (attendance === 1) return 'completed';
  return 'scheduled';
}

export function mapYclientsRecordToLesson(
  record: YclientsRecordDto,
  mappings: YclientsMappings,
  opts: {
    studentUserId: string;
    directionId?: string;
  },
): Lesson {
  const serviceId = record.services[0]?.id;
  const directionId =
    opts.directionId ??
    Object.entries(mappings.directionToServiceIds).find(([, ids]) =>
      serviceId ? ids.includes(serviceId) : false,
    )?.[0] ??
    '';

  const teacherMapped = resolveUserIdForStaff(mappings, record.staffId);
  const teacherId = teacherMapped ?? toYclientsStaffUserId(record.staffId);
  const now = record.datetime || new Date().toISOString();

  return {
    id: toYclientsLessonId(record.id),
    studentId: opts.studentUserId,
    teacherId,
    directionId,
    date: String(record.date || '').trim().slice(0, 10),
    startTime: record.startTime,
    durationMinutes: record.durationMinutes || record.services[0]?.duration || 60,
    status: attendanceToStatus(record.attendance, record.deleted),
    location: undefined,
    cancelReason: record.deleted ? record.comment : undefined,
    createdAt: now,
    updatedAt: now,
  };
}

export function findDirectionIdForService(
  mappings: YclientsMappings,
  serviceId: number,
): string | null {
  for (const [directionId, ids] of Object.entries(mappings.directionToServiceIds)) {
    if (ids.includes(serviceId)) return directionId;
  }
  return null;
}

export function requireMappedService(mappings: YclientsMappings, directionId: string): number {
  const id = resolveServiceIdForDirection(mappings, directionId);
  if (!id) {
    throw new ApiError('Направление не связано с услугой YCLIENTS', 'VALIDATION', 400);
  }
  return id;
}
