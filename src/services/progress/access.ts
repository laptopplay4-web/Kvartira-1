import { can } from '@/permissions';
import type { User } from '@/types';

export function canViewStudentProgress(user: User, studentId: string, assignedStudentIds: string[]): boolean {
  if (can(user, 'progress:view-all')) return true;
  if (can(user, 'progress:view-own') && user.id === studentId) return true;
  if (can(user, 'progress:view-assigned') && assignedStudentIds.includes(studentId)) return true;
  return false;
}

export function canManageStudentGoals(user: User, studentId: string, assignedStudentIds: string[]): boolean {
  if (!can(user, 'progress:manage-goals')) return false;
  if (can(user, 'progress:view-all')) return true;
  return assignedStudentIds.includes(studentId);
}

export function canManageStudentSkills(user: User, studentId: string, assignedStudentIds: string[]): boolean {
  if (!can(user, 'progress:manage-skills')) return false;
  if (can(user, 'progress:view-all')) return true;
  return assignedStudentIds.includes(studentId);
}
