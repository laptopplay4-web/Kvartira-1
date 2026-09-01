import { can } from '@/permissions';
import type { Assignment, User } from '@/types';
import { getAssignmentDisplayStatus } from '@/services/assignments/helpers';

export function canViewAssignment(user: User, assignment: Assignment): boolean {
  if (can(user, 'assignments:view-all')) return true;
  if (can(user, 'assignments:view-own') && assignment.studentId === user.id) return true;
  if (can(user, 'assignments:view-assigned') && assignment.teacherId === user.id) return true;
  return false;
}

export function canSubmitAssignment(user: User, assignment: Assignment): boolean {
  if (!can(user, 'assignments:submit')) return false;
  if (assignment.studentId !== user.id) return false;
  const status = getAssignmentDisplayStatus(assignment);
  return (status === 'assigned' || status === 'overdue') && !assignment.submission;
}

export function canReviewAssignment(user: User, assignment: Assignment): boolean {
  if (!can(user, 'assignments:review')) return false;
  if (assignment.teacherId !== user.id) return false;
  return assignment.status === 'submitted';
}

export function canCreateAssignment(user: User): boolean {
  return can(user, 'assignments:create');
}
