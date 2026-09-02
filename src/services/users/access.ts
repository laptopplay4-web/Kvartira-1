import { can } from '@/permissions';
import type { User, UserRole } from '@/types';

export type StaffRole = 'student' | 'teacher';

export function isStaffRole(role: UserRole): role is StaffRole {
  return role === 'student' || role === 'teacher';
}

export function getToggledStaffRole(role: UserRole): StaffRole | null {
  if (role === 'student') return 'teacher';
  if (role === 'teacher') return 'student';
  return null;
}

export function canToggleUserStaffRole(requester: User, target: User): boolean {
  if (!can(requester, 'admin:users')) return false;
  if (requester.id === target.id) return false;
  return isStaffRole(target.role);
}

export function getUserRoleChangeError(
  requester: User,
  target: User,
  newRole: UserRole,
): string | null {
  if (!can(requester, 'admin:users')) return 'Нет доступа';
  if (requester.id === target.id) return 'Нельзя изменить собственную роль';
  if (!isStaffRole(target.role) || !isStaffRole(newRole)) {
    return 'Можно менять только роли ученика и преподавателя';
  }
  if (target.role === newRole) return 'Роль уже установлена';
  return null;
}

export function canChangeUserRole(requester: User, target: User, newRole: UserRole): boolean {
  return getUserRoleChangeError(requester, target, newRole) === null;
}
