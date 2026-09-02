import { describe, it, expect, beforeEach } from 'vitest';
import { parseISO } from 'date-fns';
import { format, nextMonday } from 'date-fns';
import {
  getCalendarDateRange,
  shiftCalendarAnchor,
} from '@/utils/calendarRanges';
import {
  groupLessonsByDate,
  isLessonPast,
  buildLessonFiltersForRole,
  calendarViewerRole,
} from '@/services/calendar/helpers';
import { mockLessonsApi, resetMockDatabase } from '@/services/api/mock';
import type { Lesson } from '@/types';

const anchor = parseISO('2026-08-31');

describe('calendar date ranges', () => {
  it('day view returns single day range', () => {
    const range = getCalendarDateRange('day', anchor);
    expect(range.from).toBe('2026-08-31');
    expect(range.to).toBe('2026-08-31');
  });

  it('week view returns Mon–Sun range', () => {
    const range = getCalendarDateRange('week', anchor);
    expect(range.from).toBe('2026-08-31');
    expect(range.to).toBe('2026-09-06');
  });

  it('month view returns full month range', () => {
    const range = getCalendarDateRange('month', anchor);
    expect(range.from).toBe('2026-08-01');
    expect(range.to).toBe('2026-08-31');
  });

  it('shiftCalendarAnchor moves by day/week/month', () => {
    expect(format(shiftCalendarAnchor('day', anchor, 1), 'yyyy-MM-dd')).toBe('2026-09-01');
    expect(format(shiftCalendarAnchor('week', anchor, 1), 'yyyy-MM-dd')).toBe('2026-09-07');
    expect(format(shiftCalendarAnchor('month', anchor, 1), 'yyyy-MM-dd')).toBe('2026-10-01');
  });
});

describe('calendar helpers', () => {
  const lessons: Lesson[] = [
    {
      id: 'l1',
      studentId: 's1',
      teacherId: 't1',
      directionId: 'd1',
      date: '2026-09-01',
      startTime: '14:00',
      durationMinutes: 60,
      status: 'scheduled',
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'l2',
      studentId: 's1',
      teacherId: 't1',
      directionId: 'd1',
      date: '2026-09-01',
      startTime: '10:00',
      durationMinutes: 60,
      status: 'scheduled',
      createdAt: '',
      updatedAt: '',
    },
  ];

  it('groups and sorts lessons by date/time', () => {
    const grouped = groupLessonsByDate(lessons);
    expect(grouped.get('2026-09-01')?.map((l) => l.startTime)).toEqual(['10:00', '14:00']);
  });

  it('detects past lessons by status and time', () => {
    expect(isLessonPast({ ...lessons[0]!, status: 'completed' })).toBe(true);
    expect(isLessonPast({ ...lessons[0]!, status: 'cancelled' })).toBe(true);
  });

  it('builds role-scoped filters', () => {
    expect(buildLessonFiltersForRole('s1', 'student')).toEqual({
      requesterId: 's1',
      studentId: 's1',
    });
    expect(buildLessonFiltersForRole('t1', 'teacher')).toEqual({
      requesterId: 't1',
      teacherId: 't1',
    });
    expect(buildLessonFiltersForRole('a1', 'admin')).toEqual({
      requesterId: 'a1',
      teacherId: 'a1',
    });
    expect(buildLessonFiltersForRole('a1', 'admin', { schoolWide: true })).toEqual({
      requesterId: 'a1',
    });
    expect(
      buildLessonFiltersForRole('a1', 'admin', { schoolWide: true, teacherId: 't1' }),
    ).toEqual({
      requesterId: 'a1',
      teacherId: 't1',
    });
    expect(calendarViewerRole('admin')).toBe('teacher');
    expect(calendarViewerRole('admin', true)).toBe('admin');
    expect(calendarViewerRole('teacher')).toBe('teacher');
    expect(calendarViewerRole('student')).toBe('student');
  });
});

describe('calendar API access', () => {
  beforeEach(() => {
    resetMockDatabase();
  });

  it('student sees only own lessons in date range', async () => {
    const lessons = await mockLessonsApi.getLessons({
      requesterId: 'user-student',
      studentId: 'user-student',
      from: '2020-01-01',
      to: '2030-12-31',
    });
    expect(lessons.length).toBeGreaterThan(0);
    expect(lessons.every((l) => l.studentId === 'user-student')).toBe(true);
  });

  it('student cannot see another student lessons via requester filter', async () => {
    const lessons = await mockLessonsApi.getLessons({
      requesterId: 'user-student',
      from: '2020-01-01',
      to: '2030-12-31',
    });
    expect(lessons.every((l) => l.studentId === 'user-student')).toBe(true);
  });

  it('teacher sees only own lessons', async () => {
    const lessons = await mockLessonsApi.getLessons({
      requesterId: 'user-teacher-1',
      teacherId: 'user-teacher-1',
      from: '2020-01-01',
      to: '2030-12-31',
    });
    expect(lessons.every((l) => l.teacherId === 'user-teacher-1')).toBe(true);
  });

  it('admin can access all lessons with filters', async () => {
    const all = await mockLessonsApi.getLessons({
      requesterId: 'user-admin',
      from: '2020-01-01',
      to: '2030-12-31',
    });
    const filtered = await mockLessonsApi.getLessons({
      requesterId: 'user-admin',
      status: 'scheduled',
      from: '2020-01-01',
      to: '2030-12-31',
    });
    expect(all.length).toBeGreaterThanOrEqual(filtered.length);
    expect(filtered.every((l) => l.status === 'scheduled')).toBe(true);
  });
});

describe('booking → calendar data', () => {
  beforeEach(() => {
    resetMockDatabase();
  });

  function nextWorkday(): string {
    let d = nextMonday(new Date());
    if (d < new Date()) {
      const r = new Date(d);
      r.setDate(r.getDate() + 7);
      d = r;
    }
    return format(d, 'yyyy-MM-dd');
  }

  it('booked lesson appears in calendar date range query', async () => {
    const teachers = await mockLessonsApi.getTeachers('dir-vocal');
    const teacher = teachers[0]!;
    const date = nextWorkday();
    const slots = await mockLessonsApi.getAvailableSlots({ teacherId: teacher.id, date });
    const lesson = await mockLessonsApi.bookLesson(
      {
        teacherId: teacher.id,
        directionId: 'dir-vocal',
        date,
        startTime: slots[0]!.startTime,
      },
      'user-student',
    );

    const inRange = await mockLessonsApi.getLessons({
      requesterId: 'user-student',
      studentId: 'user-student',
      from: date,
      to: date,
    });
    expect(inRange.some((l) => l.id === lesson.id)).toBe(true);
  });

  it('reschedule moves lesson to new date in range query', async () => {
    const studentLessons = await mockLessonsApi.getLessons({
      requesterId: 'user-student',
      studentId: 'user-student',
    });
    const lesson = studentLessons.find((l) => l.status === 'scheduled');
    if (!lesson) return;

    const newDate = nextWorkday();
    const slots = await mockLessonsApi.getAvailableSlots({
      teacherId: lesson.teacherId,
      date: newDate,
      excludeLessonId: lesson.id,
    });
    if (slots.length === 0) return;

    await mockLessonsApi.rescheduleLesson(
      lesson.id,
      { date: newDate, startTime: slots[0]!.startTime },
      'user-student',
    );

    const oldDateLessons = await mockLessonsApi.getLessons({
      requesterId: 'user-student',
      from: lesson.date,
      to: lesson.date,
    });
    const activeOnOld = oldDateLessons.filter(
      (l) => l.id === lesson.id && !['cancelled', 'rescheduled'].includes(l.status),
    );
    expect(activeOnOld).toHaveLength(0);

    const newDateLessons = await mockLessonsApi.getLessons({
      requesterId: 'user-student',
      from: newDate,
      to: newDate,
    });
    expect(newDateLessons.some((l) => l.id === lesson.id)).toBe(true);
  });

  it('cancel sets cancelled status visible in calendar query', async () => {
    const studentLessons = await mockLessonsApi.getLessons({
      requesterId: 'user-student',
      studentId: 'user-student',
      status: 'scheduled',
    });
    const lesson = studentLessons[0];
    if (!lesson) return;

    await mockLessonsApi.cancelLesson(lesson.id, 'user-student');

    const updated = await mockLessonsApi.getLessons({
      requesterId: 'user-student',
      from: lesson.date,
      to: lesson.date,
    });
    const cancelled = updated.find((l) => l.id === lesson.id);
    expect(cancelled?.status).toBe('cancelled');
  });
});
