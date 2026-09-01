import { describe, it, expect, beforeEach } from 'vitest';
import { calculateAvailableSlots } from '@/services/slots/calculateSlots';
import {
  isValidTimeRange,
  isBreakWithinWorkPeriod,
  hasOverlappingBreaks,
  validateTeacherAvailability,
  validateAvailabilityExceptions,
  SLOT_INTERVAL_OPTIONS,
} from '@/services/availability/validateAvailability';
import {
  createDefaultExceptionItem,
  createDefaultFormState,
  exceptionsFromApi,
  exceptionsToApi,
  formToAvailability,
  availabilityToForm,
  toggleOffDate,
} from '@/services/availability/formHelpers';
import {
  validateAvailabilityForm,
} from '@/services/availability/validateAvailability';
import { mockAvailabilityApi, mockLessonsApi, resetMockDatabase } from '@/services/api/mock';
import { ApiError } from '@/services/api/types';
import type { TeacherAvailability } from '@/types';

describe('availability validation', () => {
  it('accepts valid work time 10:00–19:00', () => {
    expect(isValidTimeRange('10:00', '19:00')).toBe(true);
  });

  it('rejects invalid work time 19:00–10:00', () => {
    expect(isValidTimeRange('19:00', '10:00')).toBe(false);
  });

  it('accepts break inside work period', () => {
    expect(isBreakWithinWorkPeriod({ start: '13:00', end: '14:00' }, '10:00', '19:00')).toBe(true);
  });

  it('rejects break before work period', () => {
    expect(isBreakWithinWorkPeriod({ start: '09:00', end: '10:30' }, '10:00', '19:00')).toBe(false);
  });

  it('rejects break after work period', () => {
    expect(isBreakWithinWorkPeriod({ start: '18:30', end: '20:00' }, '10:00', '19:00')).toBe(false);
  });

  it('detects overlapping breaks', () => {
    expect(
      hasOverlappingBreaks([
        { start: '13:00', end: '14:00' },
        { start: '13:30', end: '15:00' },
      ]),
    ).toBe(true);
  });

  it('allows non-overlapping breaks', () => {
    expect(
      hasOverlappingBreaks([
        { start: '13:00', end: '14:00' },
        { start: '15:00', end: '16:00' },
      ]),
    ).toBe(false);
  });

  it('validates all slot intervals', () => {
    for (const interval of SLOT_INTERVAL_OPTIONS) {
      const errors = validateTeacherAvailability({
        slotIntervalMinutes: interval,
        schedule: [{ dayOfWeek: 1, ranges: [{ start: '10:00', end: '19:00' }] }],
      });
      expect(errors).toHaveLength(0);
    }
  });

  it('returns end-before-start error message', () => {
    const errors = validateTeacherAvailability({
      slotIntervalMinutes: 30,
      schedule: [{ dayOfWeek: 1, ranges: [{ start: '19:00', end: '10:00' }] }],
    });
    expect(errors[0]?.message).toBe('Время окончания должно быть позже времени начала.');
  });

  it('returns breaks overlap error message', () => {
    const errors = validateTeacherAvailability({
      slotIntervalMinutes: 30,
      schedule: [
        {
          dayOfWeek: 1,
          ranges: [{ start: '10:00', end: '19:00' }],
          breaks: [
            { start: '13:00', end: '14:00' },
            { start: '13:30', end: '15:00' },
          ],
        },
      ],
    });
    expect(errors.some((e) => e.message === 'Перерывы не должны пересекаться.')).toBe(true);
  });
});

describe('availability → calculateAvailableSlots integration', () => {
  const mondayAvailability: TeacherAvailability = {
    teacherId: 't1',
    slotIntervalMinutes: 30,
    defaultLessonDurationMinutes: 60,
    schedule: [
      {
        dayOfWeek: 1,
        ranges: [{ start: '10:00', end: '18:00' }],
        breaks: [{ start: '13:00', end: '14:00' }],
      },
    ],
  };

  it('excludes slots overlapping breaks and end of day', () => {
    const slots = calculateAvailableSlots({
      availability: mondayAvailability,
      existingLessons: [],
      date: '2026-09-07',
      dayOfWeek: 1,
    });
    const starts = slots.map((s) => s.startTime);
    expect(starts).not.toContain('12:30');
    expect(starts).not.toContain('17:30');
    expect(starts).toContain('10:00');
    expect(starts).toContain('14:00');
    expect(starts).toContain('17:00');
  });

  it('returns no slots on exception day off', () => {
    const slots = calculateAvailableSlots({
      availability: {
        ...mondayAvailability,
        exceptions: [{ date: '2026-09-07', off: true }],
      },
      existingLessons: [],
      date: '2026-09-07',
      dayOfWeek: 1,
    });
    expect(slots).toHaveLength(0);
  });

  it('uses custom hours from exception', () => {
    const slots = calculateAvailableSlots({
      availability: {
        ...mondayAvailability,
        exceptions: [{ date: '2026-09-07', ranges: [{ start: '12:00', end: '14:00' }] }],
      },
      existingLessons: [],
      date: '2026-09-07',
      dayOfWeek: 1,
    });
    expect(slots.map((s) => s.startTime)).toContain('12:00');
    expect(slots.map((s) => s.startTime)).not.toContain('10:00');
  });

  it('returns no slots outside planning period', () => {
    const slots = calculateAvailableSlots({
      availability: {
        ...mondayAvailability,
        planningPeriod: { startDate: '2026-09-01', endDate: '2026-09-30' },
      },
      existingLessons: [],
      date: '2026-10-05',
      dayOfWeek: 1,
    });
    expect(slots).toHaveLength(0);
  });

  it('returns slots inside planning period', () => {
    const slots = calculateAvailableSlots({
      availability: {
        ...mondayAvailability,
        planningPeriod: { startDate: '2026-09-01', endDate: '2026-09-30' },
      },
      existingLessons: [],
      date: '2026-09-07',
      dayOfWeek: 1,
    });
    expect(slots.length).toBeGreaterThan(0);
  });
});

describe('availability period form', () => {
  it('converts form with period and off dates to API payload', () => {
    const form = createDefaultFormState();
    form.periodStart = '2026-09-01';
    form.periodEnd = '2026-09-30';
    form.workHours = { startTime: '10:00', endTime: '18:00', breaks: [] };
    form.offDates = ['2026-09-07'];

    const api = formToAvailability('teacher-1', form);
    expect(api.planningPeriod).toEqual({ startDate: '2026-09-01', endDate: '2026-09-30' });
    expect(api.schedule).toHaveLength(7);
    expect(api.exceptions).toEqual([{ date: '2026-09-07', off: true }]);
  });

  it('roundtrips planning period from API to form', () => {
    const original = formToAvailability('teacher-1', {
      ...createDefaultFormState(),
      periodStart: '2026-09-01',
      periodEnd: '2026-09-15',
      offDates: ['2026-09-03'],
    });
    const form = availabilityToForm(original);
    expect(form.periodStart).toBe('2026-09-01');
    expect(form.periodEnd).toBe('2026-09-15');
    expect(form.offDates).toContain('2026-09-03');
  });

  it('toggles off date in set', () => {
    expect(toggleOffDate(['2026-09-01'], '2026-09-01')).toEqual([]);
    expect(toggleOffDate([], '2026-09-01')).toEqual(['2026-09-01']);
  });

  it('validates period form work hours', () => {
    const form = createDefaultFormState();
    form.periodStart = '2099-01-01';
    form.periodEnd = '2099-01-31';
    form.workHours.endTime = '08:00';
    const errors = validateAvailabilityForm(form, '2026-01-01');
    expect(errors.some((e) => e.field === 'endTime')).toBe(true);
  });
});

describe('availability exceptions helpers', () => {
  it('expands vacation range to daily off exceptions', () => {
    const item = {
      ...createDefaultExceptionItem('2026-10-01'),
      endDate: '2026-10-03',
      type: 'off' as const,
    };
    const expanded = exceptionsToApi([item]);
    expect(expanded).toEqual([
      { date: '2026-10-01', off: true },
      { date: '2026-10-02', off: true },
      { date: '2026-10-03', off: true },
    ]);
  });

  it('merges consecutive off days when loading from API', () => {
    const formItems = exceptionsFromApi([
      { date: '2026-10-01', off: true },
      { date: '2026-10-02', off: true },
      { date: '2026-10-05', ranges: [{ start: '11:00', end: '15:00' }] },
    ]);
    expect(formItems).toHaveLength(2);
    expect(formItems[0]).toMatchObject({
      startDate: '2026-10-01',
      endDate: '2026-10-02',
      type: 'off',
    });
    expect(formItems[1]).toMatchObject({
      startDate: '2026-10-05',
      endDate: '2026-10-05',
      type: 'custom',
      startTime: '11:00',
      endTime: '15:00',
    });
  });

  it('rejects duplicate exception dates', () => {
    const errors = validateAvailabilityExceptions([
      createDefaultExceptionItem('2026-12-01'),
      createDefaultExceptionItem('2026-12-01'),
    ], '2026-08-01');
    expect(errors.some((e) => e.field === 'exceptions')).toBe(true);
  });

  it('rejects end date before start date', () => {
    const item = createDefaultExceptionItem('2026-12-05');
    const errors = validateAvailabilityExceptions(
      [{ ...item, endDate: '2026-12-01' }],
      '2026-08-01',
    );
    expect(errors[0]?.message).toContain('окончания');
  });
});

describe('mock availability API permissions', () => {
  beforeEach(() => {
    resetMockDatabase();
  });

  it('student cannot update teacher availability', async () => {
    await expect(
      mockAvailabilityApi.updateTeacherAvailability(
        'user-teacher-1',
        {
          slotIntervalMinutes: 30,
          schedule: [{ dayOfWeek: 1, ranges: [{ start: '10:00', end: '18:00' }] }],
        },
        'user-student',
      ),
    ).rejects.toThrow(ApiError);
  });

  it('teacher A cannot update teacher B availability', async () => {
    await expect(
      mockAvailabilityApi.updateTeacherAvailability(
        'user-teacher-2',
        {
          slotIntervalMinutes: 30,
          schedule: [{ dayOfWeek: 1, ranges: [{ start: '10:00', end: '18:00' }] }],
        },
        'user-teacher-1',
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('teacher A can update own availability', async () => {
    const updated = await mockAvailabilityApi.updateTeacherAvailability(
      'user-teacher-1',
      {
        slotIntervalMinutes: 15,
        schedule: [
          {
            dayOfWeek: 1,
            ranges: [{ start: '10:00', end: '18:00' }],
            breaks: [{ start: '13:00', end: '14:00' }],
          },
        ],
      },
      'user-teacher-1',
    );
    expect(updated.slotIntervalMinutes).toBe(15);
  });

  it('admin can update teacher availability', async () => {
    const updated = await mockAvailabilityApi.updateTeacherAvailability(
      'user-teacher-1',
      {
        slotIntervalMinutes: 60,
        schedule: [{ dayOfWeek: 2, ranges: [{ start: '09:00', end: '17:00' }] }],
      },
      'user-admin',
    );
    expect(updated.slotIntervalMinutes).toBe(60);
  });

  it('updated availability affects slot calculation', async () => {
    await mockAvailabilityApi.updateTeacherAvailability(
      'user-teacher-1',
      {
        slotIntervalMinutes: 30,
        schedule: [
          {
            dayOfWeek: 1,
            ranges: [{ start: '10:00', end: '18:00' }],
            breaks: [{ start: '13:00', end: '14:00' }],
          },
        ],
      },
      'user-teacher-1',
    );

    const monday = '2026-09-07';
    const slots = await mockLessonsApi.getAvailableSlots({
      teacherId: 'user-teacher-1',
      date: monday,
      durationMinutes: 60,
    });
    const starts = slots.map((s) => s.startTime);
    expect(starts).not.toContain('12:30');
    expect(starts).not.toContain('17:30');
  });

  it('saves exceptions and blocks slots on day off', async () => {
    const dayOff = '2026-12-15';
    await mockAvailabilityApi.updateTeacherAvailability(
      'user-teacher-1',
      {
        slotIntervalMinutes: 30,
        schedule: [{ dayOfWeek: 1, ranges: [{ start: '10:00', end: '18:00' }] }],
        exceptions: [{ date: dayOff, off: true }],
      },
      'user-teacher-1',
    );

    const availability = await mockAvailabilityApi.getTeacherAvailability(
      'user-teacher-1',
      'user-teacher-1',
    );
    expect(availability?.exceptions).toEqual([{ date: dayOff, off: true }]);

    const slots = await mockLessonsApi.getAvailableSlots({
      teacherId: 'user-teacher-1',
      date: dayOff,
      durationMinutes: 60,
    });
    expect(slots).toHaveLength(0);
  });
});
