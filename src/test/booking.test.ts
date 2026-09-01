import { describe, it, expect, beforeEach } from 'vitest';
import { format, nextMonday } from 'date-fns';
import { mockLessonsApi, resetMockDatabase } from '@/services/api/mock';

function nextWorkday(): string {
  let d = nextMonday(new Date());
  if (d < new Date()) d = nextMonday(addDaysFix(d, 7));
  return format(d, 'yyyy-MM-dd');
}

function addDaysFix(date: Date, days: number): Date {
  const r = new Date(date);
  r.setDate(r.getDate() + days);
  return r;
}

describe('mock booking API', () => {
  beforeEach(() => {
    resetMockDatabase();
  });

  it('books an available slot', async () => {
    const teachers = await mockLessonsApi.getTeachers('dir-vocal');
    const teacher = teachers[0]!;
    const date = nextWorkday();
    const slots = await mockLessonsApi.getAvailableSlots({ teacherId: teacher.id, date });
    expect(slots.length).toBeGreaterThan(0);

    const lesson = await mockLessonsApi.bookLesson(
      {
        teacherId: teacher.id,
        directionId: 'dir-vocal',
        date,
        startTime: slots[0]!.startTime,
      },
      'user-student',
    );
    expect(lesson.status).toBe('scheduled');
  });

  it('prevents double booking', async () => {
    const teachers = await mockLessonsApi.getTeachers('dir-vocal');
    const teacher = teachers[0]!;
    const date = nextWorkday();
    const slots = await mockLessonsApi.getAvailableSlots({ teacherId: teacher.id, date });
    const slot = slots[0]!;

    await mockLessonsApi.bookLesson(
      { teacherId: teacher.id, directionId: 'dir-vocal', date, startTime: slot.startTime },
      'user-student',
    );

    await expect(
      mockLessonsApi.bookLesson(
        { teacherId: teacher.id, directionId: 'dir-vocal', date, startTime: slot.startTime },
        'user-student-2',
      ),
    ).rejects.toThrow('занят');
  });

  it('reschedules a lesson', async () => {
    const lessons = await mockLessonsApi.getLessons({ studentId: 'user-student' });
    const lesson = lessons.find((l) => l.status === 'confirmed' || l.status === 'scheduled')!;
    const newDate = nextWorkday();
    const slots = await mockLessonsApi.getAvailableSlots({
      teacherId: lesson.teacherId,
      date: newDate,
      excludeLessonId: lesson.id,
    });
    expect(slots.length).toBeGreaterThan(0);

    const updated = await mockLessonsApi.rescheduleLesson(
      lesson.id,
      { date: newDate, startTime: slots[0]!.startTime },
      'user-student',
    );
    expect(updated.status).toBe('rescheduled');
    expect(updated.date).toBe(newDate);
  });

  it('cancels a lesson and frees the slot', async () => {
    const lessons = await mockLessonsApi.getLessons({ studentId: 'user-student' });
    const lesson = lessons.find((l) => !['cancelled', 'completed'].includes(l.status))!;
    const cancelled = await mockLessonsApi.cancelLesson(lesson.id, 'user-student', 'Не могу прийти');
    expect(cancelled.status).toBe('cancelled');

    const history = await mockLessonsApi.getLessonHistory(lesson.id, 'user-student');
    expect(history.some((h) => h.action === 'cancelled')).toBe(true);

    const slots = await mockLessonsApi.getAvailableSlots({
      teacherId: lesson.teacherId,
      date: lesson.date,
    });
    expect(slots.some((s) => s.startTime === lesson.startTime)).toBe(true);
  });

  it('denies access to another student lesson', async () => {
    await expect(mockLessonsApi.getLesson('lesson-2', 'user-student')).rejects.toThrow('доступа');
  });

  it('denies reschedule of another student lesson', async () => {
    await expect(
      mockLessonsApi.rescheduleLesson('lesson-2', { date: '2026-12-01', startTime: '10:00' }, 'user-student'),
    ).rejects.toThrow('прав');
  });
});
