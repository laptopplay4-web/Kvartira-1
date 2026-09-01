import { parse, format, addMinutes, isBefore } from 'date-fns';
import type { Lesson, TeacherAvailability, TimeRange, TimeSlot } from '@/types';
import { isSlotInPast } from '@/utils/dates';

const TIME_FMT = 'HH:mm';

function parseTime(time: string): Date {
  return parse(time, TIME_FMT, new Date());
}

function formatTime(date: Date): string {
  return format(date, TIME_FMT);
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return isBefore(aStart, bEnd) && isBefore(bStart, aEnd);
}

function subtractBreaks(ranges: TimeRange[], breaks: TimeRange[] = []): TimeRange[] {
  let result = [...ranges];
  for (const brk of breaks) {
    const next: TimeRange[] = [];
    const bStart = parseTime(brk.start);
    const bEnd = parseTime(brk.end);
    for (const range of result) {
      const rStart = parseTime(range.start);
      const rEnd = parseTime(range.end);
      if (!rangesOverlap(rStart, rEnd, bStart, bEnd)) {
        next.push(range);
        continue;
      }
      if (isBefore(rStart, bStart)) {
        next.push({ start: range.start, end: brk.start });
      }
      if (isBefore(bEnd, rEnd)) {
        next.push({ start: brk.end, end: range.end });
      }
    }
    result = next.filter((r) => parseTime(r.start) < parseTime(r.end));
  }
  return result;
}

function getDayRanges(
  availability: TeacherAvailability,
  date: string,
  dayOfWeek: number,
): TimeRange[] {
  const period = availability.planningPeriod;
  if (period && (date < period.startDate || date > period.endDate)) {
    return [];
  }

  const exception = availability.exceptions?.find((e) => e.date === date);
  if (exception?.off) return [];
  if (exception?.ranges) return subtractBreaks(exception.ranges, []);

  const daySchedule = availability.schedule.find((d) => d.dayOfWeek === dayOfWeek);
  if (!daySchedule) return [];

  return subtractBreaks(daySchedule.ranges, daySchedule.breaks);
}

function lessonOverlapsSlot(
  lesson: Lesson,
  date: string,
  slotStart: Date,
  slotEnd: Date,
): boolean {
  if (lesson.date !== date) return false;
  if (lesson.status === 'cancelled') return false;

  const lessonStart = parseTime(lesson.startTime);
  const lessonEnd = addMinutes(lessonStart, lesson.durationMinutes);
  return rangesOverlap(slotStart, slotEnd, lessonStart, lessonEnd);
}

export interface CalculateSlotsParams {
  availability: TeacherAvailability;
  existingLessons: Lesson[];
  date: string;
  dayOfWeek: number;
  lessonDurationMinutes?: number;
  excludeLessonId?: string;
  now?: Date;
}

export function calculateAvailableSlots(params: CalculateSlotsParams): TimeSlot[] {
  const {
    availability,
    existingLessons,
    date,
    dayOfWeek,
    lessonDurationMinutes = availability.defaultLessonDurationMinutes,
    excludeLessonId,
    now = new Date(),
  } = params;

  const workingRanges = getDayRanges(availability, date, dayOfWeek);
  if (workingRanges.length === 0) return [];

  const interval = availability.slotIntervalMinutes;
  const slots: TimeSlot[] = [];
  const activeLessons = existingLessons.filter(
    (l) => l.teacherId === availability.teacherId && l.id !== excludeLessonId,
  );

  for (const range of workingRanges) {
    let cursor = parseTime(range.start);
    const rangeEnd = parseTime(range.end);

    while (isBefore(cursor, rangeEnd)) {
      const slotEnd = addMinutes(cursor, lessonDurationMinutes);
      if (isBefore(rangeEnd, slotEnd)) break;

      const startTime = formatTime(cursor);
      const endTime = formatTime(slotEnd);

      const hasConflict = activeLessons.some((lesson) =>
        lessonOverlapsSlot(lesson, date, cursor, slotEnd),
      );

      const isPast = isSlotInPast(date, startTime, now);

      if (!hasConflict && !isPast) {
        slots.push({ date, startTime, endTime });
      }

      cursor = addMinutes(cursor, interval);
      if (cursor >= rangeEnd) break;
    }
  }

  return slots;
}

export function slotsConflict(
  lessons: Lesson[],
  teacherId: string,
  date: string,
  startTime: string,
  durationMinutes: number,
  excludeLessonId?: string,
): boolean {
  const slotStart = parseTime(startTime);
  const slotEnd = addMinutes(slotStart, durationMinutes);

  return lessons.some((lesson) => {
    if (lesson.id === excludeLessonId) return false;
    if (lesson.teacherId !== teacherId) return false;
    return lessonOverlapsSlot(lesson, date, slotStart, slotEnd);
  });
}
