import { can } from '@/permissions';
import { isAccountPending } from '@/services/users/accountStatus';
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
  if (isAccountPending(target)) return false;
  return isStaffRole(target.role);
}

export function getUserRoleChangeError(
  requester: User,
  target: User,
  newRole: UserRole,
): string | null {
  if (!can(requester, 'admin:users')) return 'Нет доступа';
  if (requester.id === target.id) return 'Нельзя изменить собственную роль';
  if (isAccountPending(target)) return 'Сначала подтвердите заявку на регистрацию';
  if (!isStaffRole(target.role) || !isStaffRole(newRole)) {
    return 'Можно менять только роли ученика и преподавателя';
  }
  if (target.role === newRole) return 'Роль уже установлена';
  return null;
}

export function canChangeUserRole(requester: User, target: User, newRole: UserRole): boolean {
  return getUserRoleChangeError(requester, target, newRole) === null;
}

export function getAccountApprovalError(requester: User, target: User): string | null {
  if (!can(requester, 'admin:users')) return 'Нет доступа';
  if (requester.id === target.id) return 'Нельзя подтвердить собственный аккаунт';
  if (target.role === 'admin') return 'Администраторы не требуют подтверждения';
  if (!isAccountPending(target)) return 'Заявка уже обработана';
  return null;
}

export function canApproveUser(requester: User, target: User): boolean {
  return getAccountApprovalError(requester, target) === null;
}

export function getAccountRejectError(requester: User, target: User): string | null {
  if (!can(requester, 'admin:users')) return 'Нет доступа';
  if (requester.id === target.id) return 'Нельзя отклонить собственный аккаунт';
  if (target.role === 'admin') return 'Нельзя отклонить администратора';
  if (!isAccountPending(target)) return 'Отклонять можно только ожидающие заявки';
  return null;
}

export function canRejectUser(requester: User, target: User): boolean {
  return getAccountRejectError(requester, target) === null;
}
