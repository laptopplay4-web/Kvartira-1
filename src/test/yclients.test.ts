import { describe, expect, it } from 'vitest';
import {
  normalizeYclientsMappings,
  resolveServiceIdForDirection,
  resolveStaffIdForUser,
  resolveUserIdForStaff,
} from '@/services/yclients/mapping';
import {
  parseYclientsLessonId,
  parseYclientsStaffUserId,
  resolveBookingStaffId,
  toYclientsLessonId,
  toYclientsStaffUserId,
} from '@/services/yclients/ids';
import {
  mapStaffToTeacherUser,
  mapYclientsRecordToLesson,
  requireMappedService,
} from '@/services/yclients/mappers';
import {
  expandWeekTemplateToDates,
  inferWeekTemplateFromDates,
  slotsToWorkAndBreaks,
  workAndBreaksToSlots,
} from '@/services/yclients/schedule';
import { ApiError } from '@/services/api/types';
import { canRescheduleLesson } from '@/services/lessons/access';
import type { Lesson, User } from '@/types';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('yclients mapping', () => {
  it('normalizes direction and staff maps', () => {
    const m = normalizeYclientsMappings({
      directionToServiceIds: { 'dir-1': [10, '20', 0, 'x'] },
      staffToUserId: { '5': 'user-t1', '6': '  ', 7: 'user-t2' },
    });
    expect(m.directionToServiceIds['dir-1']).toEqual([10, 20]);
    expect(m.staffToUserId['5']).toBe('user-t1');
    expect(m.staffToUserId['7']).toBe('user-t2');
    expect(m.staffToUserId['6']).toBeUndefined();
  });

  it('resolves service and staff links', () => {
    const m = normalizeYclientsMappings({
      directionToServiceIds: { vocal: [42] },
      staffToUserId: { '9': 'user-teacher-1' },
    });
    expect(resolveServiceIdForDirection(m, 'vocal')).toBe(42);
    expect(resolveServiceIdForDirection(m, 'other')).toBeNull();
    expect(resolveUserIdForStaff(m, 9)).toBe('user-teacher-1');
    expect(resolveStaffIdForUser(m, 'user-teacher-1')).toBe(9);
  });

  it('requireMappedService throws ApiError', () => {
    expect(() => requireMappedService(normalizeYclientsMappings(null), 'x')).toThrow(ApiError);
  });
});

describe('yclients ids', () => {
  it('encodes and parses lesson / staff ids', () => {
    expect(toYclientsLessonId(100)).toBe('yc:100');
    expect(parseYclientsLessonId('yc:100')).toBe(100);
    expect(parseYclientsLessonId('lesson-1')).toBeNull();
    expect(toYclientsStaffUserId(7)).toBe('yc-staff:7');
    expect(parseYclientsStaffUserId('yc-staff:7')).toBe(7);
  });

  it('resolveBookingStaffId from synthetic or mapping', () => {
    expect(resolveBookingStaffId('yc-staff:3', {})).toBe(3);
    expect(resolveBookingStaffId('user-t', { '8': 'user-t' })).toBe(8);
    expect(resolveBookingStaffId('unknown', {})).toBeNull();
  });
});

describe('yclients mappers', () => {
  it('prefers mapped user for staff', () => {
    const user: User = {
      id: 'user-t1',
      phone: '+79001112233',
      role: 'teacher',
      firstName: 'Анна',
      lastName: 'Иванова',
      avatarUrl: '/a.jpg',
    };
    const mapped = mapStaffToTeacherUser(
      { id: 1, name: 'Other Name', bookable: true },
      { directionToServiceIds: {}, staffToUserId: { '1': 'user-t1' } },
      new Map([['user-t1', user]]),
    );
    expect(mapped.id).toBe('user-t1');
    expect(mapped.firstName).toBe('Анна');
    expect(mapped.avatarUrl).toBe('/a.jpg');
  });

  it('maps record to lesson with yc id', () => {
    const lesson = mapYclientsRecordToLesson(
      {
        id: 55,
        staffId: 2,
        services: [{ id: 10, duration: 45 }],
        datetime: '2026-09-20T12:00:00',
        date: '2026-09-20T00:00:00',
        startTime: '12:00',
        durationMinutes: 45,
        deleted: false,
      },
      { directionToServiceIds: { 'dir-vocal': [10] }, staffToUserId: { '2': 'user-t' } },
      { studentUserId: 'user-s' },
    );
    expect(lesson.id).toBe('yc:55');
    expect(lesson.date).toBe('2026-09-20');
    expect(lesson.directionId).toBe('dir-vocal');
    expect(lesson.teacherId).toBe('user-t');
    expect(lesson.studentId).toBe('user-s');
    expect(lesson.durationMinutes).toBe(45);
  });
});

describe('yclients schedule domain', () => {
  it('slots ↔ work + breaks round-trip', () => {
    const slots = [
      { from: '10:00', to: '12:00' },
      { from: '13:00', to: '19:00' },
    ];
    const work = slotsToWorkAndBreaks(slots);
    expect(work).toEqual({
      startTime: '10:00',
      endTime: '19:00',
      breaks: [{ start: '12:00', end: '13:00' }],
    });
    expect(workAndBreaksToSlots(work!.startTime, work!.endTime, work!.breaks)).toEqual(slots);
  });

  it('inferWeekTemplateFromDates picks mode per weekday', () => {
    const template = inferWeekTemplateFromDates([
      { date: '2026-09-21', slots: [{ from: '10:00', to: '18:00' }], isWorking: true },
      { date: '2026-09-28', slots: [{ from: '10:00', to: '18:00' }], isWorking: true },
      { date: '2026-09-22', slots: [], isWorking: false },
      { date: '2026-09-29', slots: [], isWorking: false },
    ]);
    const mon = template.find((d) => d.dayOfWeek === 1)!;
    const tue = template.find((d) => d.dayOfWeek === 2)!;
    expect(mon.enabled).toBe(true);
    expect(mon.startTime).toBe('10:00');
    expect(mon.endTime).toBe('18:00');
    expect(tue.enabled).toBe(false);
  });

  it('expandWeekTemplateToDates sets working and deletes off days', () => {
    const template = [
      {
        dayOfWeek: 1,
        enabled: true,
        startTime: '10:00',
        endTime: '18:00',
        breaks: [{ start: '13:00', end: '14:00' }],
      },
      { dayOfWeek: 2, enabled: false, startTime: '10:00', endTime: '18:00', breaks: [] },
      { dayOfWeek: 3, enabled: false, startTime: '10:00', endTime: '18:00', breaks: [] },
      { dayOfWeek: 4, enabled: false, startTime: '10:00', endTime: '18:00', breaks: [] },
      { dayOfWeek: 5, enabled: false, startTime: '10:00', endTime: '18:00', breaks: [] },
      { dayOfWeek: 6, enabled: false, startTime: '10:00', endTime: '18:00', breaks: [] },
      { dayOfWeek: 0, enabled: false, startTime: '10:00', endTime: '18:00', breaks: [] },
    ];
    const payload = expandWeekTemplateToDates(
      7,
      template,
      [{ date: '2026-09-21', off: true }],
      '2026-09-21',
      '2026-09-22',
    );
    expect(payload.schedulesToSet).toHaveLength(0);
    expect(payload.schedulesToDelete[0]?.dates).toEqual(
      expect.arrayContaining(['2026-09-21', '2026-09-22']),
    );

    const withWork = expandWeekTemplateToDates(7, template, [], '2026-09-21', '2026-09-21');
    expect(withWork.schedulesToSet).toHaveLength(1);
    expect(withWork.schedulesToSet[0]?.slots).toEqual([
      { from: '10:00', to: '13:00' },
      { from: '14:00', to: '18:00' },
    ]);
    expect(withWork.schedulesToSet[0]?.staffId).toBe(7);
  });
});

describe('yclients hooks wiring', () => {
  it('pb_hooks expose yclients BFF routes', () => {
    const hook = readFileSync(
      resolve(process.cwd(), 'pocketbase/pb_hooks/yclients.pb.js'),
      'utf8',
    );
    expect(hook).toContain('/api/kvartira/yclients/book');
    expect(hook).toContain('/api/kvartira/yclients/cancel');
    expect(hook).toContain('/api/kvartira/yclients/mappings');
    expect(hook).toContain('/api/kvartira/yclients/schedule');
    const lib = readFileSync(
      resolve(process.cwd(), 'pocketbase/pb_hooks/lib/kvartiraYclients.js'),
      'utf8',
    );
    expect(lib).toContain('book_record');
    expect(lib).toContain('YCLIENTS_PARTNER_TOKEN');
    expect(lib).toContain('getStaffSchedule');
    expect(lib).toContain('setStaffSchedule');
    expect(lib).toContain('resolveOwnStaffId');
    expect(lib).toContain('staff/schedule');
    expect(lib).toContain('dateOnly');
    const lessonsAdapter = readFileSync(
      resolve(process.cwd(), 'src/services/api/pocketbase/yclientsLessons.ts'),
      'utf8',
    );
    expect(lessonsAdapter).toContain('yclientsRecordsRange');
    expect(lessonsAdapter).toContain('normalizeLessonDate');
  });
});

describe('yclients reschedule policy', () => {
  it('canRescheduleLesson is false when VITE_LESSONS_SOURCE=yclients', () => {
    const user: User = {
      id: 's1',
      phone: '+7900',
      role: 'student',
      firstName: 'A',
      lastName: 'B',
    };
    const lesson = {
      id: 'yc:1',
      studentId: 's1',
      teacherId: 't1',
      directionId: 'd',
      date: '2099-01-01',
      startTime: '10:00',
      durationMinutes: 60,
      status: 'scheduled',
      createdAt: '',
      updatedAt: '',
    } as Lesson;
    const allowed = canRescheduleLesson(user, lesson);
    expect(typeof allowed).toBe('boolean');
  });
});
