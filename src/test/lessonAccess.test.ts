import { describe, it, expect } from 'vitest';
import { canViewLesson, canRescheduleLesson, canCancelLesson } from '@/services/lessons/access';
import type { Lesson, User } from '@/types';

const student: User = { id: 's1', phone: '+7', role: 'student', firstName: 'A', lastName: 'B' };
const otherStudent: User = { id: 's2', phone: '+7', role: 'student', firstName: 'C', lastName: 'D' };
const teacher: User = { id: 't1', phone: '+7', role: 'teacher', firstName: 'E', lastName: 'F' };
const admin: User = { id: 'a1', phone: '+7', role: 'admin', firstName: 'G', lastName: 'H' };

const lesson: Lesson = {
  id: 'l1',
  studentId: 's1',
  teacherId: 't1',
  directionId: 'd1',
  date: '2026-09-01',
  startTime: '10:00',
  durationMinutes: 60,
  status: 'scheduled',
  createdAt: '',
  updatedAt: '',
};

describe('lesson access', () => {
  it('student can view own lesson', () => {
    expect(canViewLesson(student, lesson)).toBe(true);
  });

  it('student cannot view another student lesson', () => {
    expect(canViewLesson(otherStudent, lesson)).toBe(false);
  });

  it('teacher can view assigned lesson', () => {
    expect(canViewLesson(teacher, lesson)).toBe(true);
  });

  it('admin can view any lesson', () => {
    expect(canViewLesson(admin, lesson)).toBe(true);
  });

  it('student can reschedule own lesson', () => {
    expect(canRescheduleLesson(student, lesson)).toBe(true);
  });

  it('student cannot cancel completed lesson', () => {
    expect(canCancelLesson(student, { ...lesson, status: 'completed' })).toBe(false);
  });
});
