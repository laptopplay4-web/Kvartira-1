import { actsAsTeacher } from '@/permissions';
import type { Lesson, TeacherAvailability, TimeRange, User } from '@/types';
import { isSlotInPast } from '@/utils/dates';
import { formatUserName } from '@/utils';

export function sortLessonsByTime(lessons: Lesson[]): Lesson[] {
  return [...lessons].sort((a, b) =>
    `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`),
  );
}

export function groupLessonsByDate(lessons: Lesson[]): Map<string, Lesson[]> {
  const map = new Map<string, Lesson[]>();
  for (const lesson of sortLessonsByTime(lessons)) {
    const list = map.get(lesson.date) ?? [];
    list.push(lesson);
    map.set(lesson.date, list);
  }
  return map;
}

export function isLessonPast(lesson: Lesson, now = new Date()): boolean {
  if (['completed', 'cancelled', 'no_show'].includes(lesson.status)) return true;
  return isSlotInPast(lesson.date, lesson.startTime, now);
}

export function getLessonCounterpartyName(
  _lesson: Lesson,
  viewerRole: User['role'],
  teacher?: User,
  student?: User,
): string {
  if (viewerRole === 'student' && teacher) return formatUserName(teacher);
  if (viewerRole === 'teacher' && student) return formatUserName(student);
  if (viewerRole === 'admin') {
    const parts = [teacher && formatUserName(teacher), student && formatUserName(student)].filter(Boolean);
    return parts.join(' · ') || '—';
  }
  return teacher ? formatUserName(teacher) : student ? formatUserName(student) : '—';
}

export function getDayScheduleForDate(
  availability: TeacherAvailability,
  date: string,
  dayOfWeek: number,
): { ranges: TimeRange[]; breaks: TimeRange[] } {
  const exception = availability.exceptions?.find((e) => e.date === date);
  if (exception?.off) return { ranges: [], breaks: [] };
  if (exception?.ranges) return { ranges: exception.ranges, breaks: [] };

  const daySchedule = availability.schedule.find((d) => d.dayOfWeek === dayOfWeek);
  if (!daySchedule) return { ranges: [], breaks: [] };

  return { ranges: daySchedule.ranges, breaks: daySchedule.breaks ?? [] };
}

export function calendarViewerRole(
  role: User['role'],
  schoolWide = false,
): User['role'] {
  if (schoolWide) return role;
  return actsAsTeacher(role) ? 'teacher' : role;
}

export function buildLessonFiltersForRole(
  userId: string,
  role: User['role'],
  extra?: { teacherId?: string; studentId?: string; schoolWide?: boolean },
): { studentId?: string; teacherId?: string; requesterId: string } {
  const viewRole = calendarViewerRole(role, extra?.schoolWide);
  const base = { requesterId: userId };
  if (viewRole === 'student') return { ...base, studentId: extra?.studentId ?? userId };
  if (viewRole === 'teacher') return { ...base, teacherId: extra?.teacherId ?? userId };
  return {
    ...base,
    ...(extra?.teacherId ? { teacherId: extra.teacherId } : {}),
    ...(extra?.studentId ? { studentId: extra.studentId } : {}),
  };
}
