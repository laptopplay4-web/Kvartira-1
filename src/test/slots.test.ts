import { describe, it, expect } from 'vitest';
import { calculateAvailableSlots, slotsConflict } from '@/services/slots/calculateSlots';
import type { Lesson, TeacherAvailability } from '@/types';

/**
 * Slots in the past are filtered out, so a hardcoded date turns the suite into
 * a time bomb. Always test against the next upcoming Monday.
 */
function nextMondayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() !== 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const MONDAY = nextMondayIso();

const availability: TeacherAvailability = {
  teacherId: 't1',
  slotIntervalMinutes: 30,
  defaultLessonDurationMinutes: 60,
  schedule: [
    {
      dayOfWeek: 1,
      ranges: [{ start: '10:00', end: '14:00' }],
      breaks: [{ start: '12:00', end: '13:00' }],
    },
  ],
};

const baseLesson: Lesson = {
  id: 'l1',
  studentId: 's1',
  teacherId: 't1',
  directionId: 'd1',
  date: MONDAY,
  startTime: '10:00',
  durationMinutes: 60,
  status: 'confirmed',
  createdAt: '',
  updatedAt: '',
};

describe('calculateAvailableSlots', () => {
  it('generates slots respecting breaks and duration', () => {
    const slots = calculateAvailableSlots({
      availability,
      existingLessons: [],
      date: MONDAY,
      dayOfWeek: 1,
    });

    const starts = slots.map((s) => s.startTime);
    expect(starts).toContain('10:00');
    expect(starts).toContain('13:00');
    expect(starts).not.toContain('12:00');
    expect(starts).not.toContain('12:30');
  });

  it('excludes occupied slots', () => {
    const slots = calculateAvailableSlots({
      availability,
      existingLessons: [baseLesson],
      date: MONDAY,
      dayOfWeek: 1,
    });

    expect(slots.some((s) => s.startTime === '10:00')).toBe(false);
    expect(slots.some((s) => s.startTime === '13:00')).toBe(true);
  });

  it('excludes past slots for today', () => {
    const now = new Date(`${MONDAY}T15:20:00`);
    const slots = calculateAvailableSlots({
      availability: {
        ...availability,
        schedule: [{ dayOfWeek: 1, ranges: [{ start: '10:00', end: '18:00' }] }],
      },
      existingLessons: [],
      date: MONDAY,
      dayOfWeek: 1,
      now,
    });

    const starts = slots.map((s) => s.startTime);
    expect(starts).not.toContain('15:00');
    expect(starts).toContain('16:00');
  });

  it('does not offer slots that extend beyond working hours', () => {
    const slots = calculateAvailableSlots({
      availability: {
        ...availability,
        schedule: [{ dayOfWeek: 1, ranges: [{ start: '10:00', end: '18:00' }] }],
      },
      existingLessons: [],
      date: MONDAY,
      dayOfWeek: 1,
    });

    const starts = slots.map((s) => s.startTime);
    expect(starts).toContain('17:00');
    expect(starts).not.toContain('17:30');
  });
});

describe('slotsConflict', () => {
  it('detects overlapping lessons', () => {
    expect(slotsConflict([baseLesson], 't1', MONDAY, '10:30', 60)).toBe(true);
    expect(slotsConflict([baseLesson], 't1', MONDAY, '13:00', 60)).toBe(false);
  });

  it('ignores cancelled lessons', () => {
    const cancelled = { ...baseLesson, status: 'cancelled' as const };
    expect(slotsConflict([cancelled], 't1', MONDAY, '10:00', 60)).toBe(false);
  });
});
