import { can } from '@/permissions';
import { isYclientsLessonsEnabled } from '@/config/features';
import type { Lesson, User } from '@/types';

export function canViewLesson(user: User, lesson: Lesson): boolean {
  if (can(user, 'lessons:view-all')) return true;
  if (can(user, 'lessons:view-assigned') && lesson.teacherId === user.id) return true;
  if (can(user, 'lessons:view-own') && lesson.studentId === user.id) return true;
  return false;
}

export function canRescheduleLesson(user: User, lesson: Lesson): boolean {
  // YCLIENTS v1: no reschedule — cancel + rebook only
  if (isYclientsLessonsEnabled()) return false;
  if (['cancelled', 'completed'].includes(lesson.status)) return false;
  if (can(user, 'lessons:manage-own') && lesson.teacherId === user.id) return true;
  if (can(user, 'lessons:reschedule-own') && lesson.studentId === user.id) return true;
  return false;
}

export function canCancelLesson(user: User, lesson: Lesson): boolean {
  if (['cancelled', 'completed'].includes(lesson.status)) return false;
  if (can(user, 'lessons:manage-own') && lesson.teacherId === user.id) return true;
  if (can(user, 'lessons:cancel-own') && lesson.studentId === user.id) return true;
  return false;
}

export function canEditTeacherNotes(user: User, lesson: Lesson): boolean {
  return can(user, 'lessons:manage-own') && lesson.teacherId === user.id;
}
