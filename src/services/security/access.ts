import { can } from '@/permissions';
import type { User } from '@/types';

export function canViewSecurity(user: User, targetUserId: string): boolean {
  if (!can(user, 'security:view-own')) return false;
  return user.id === targetUserId;
}

export function canChangePassword(user: User, targetUserId: string): boolean {
  if (!can(user, 'security:manage-password')) return false;
  return user.id === targetUserId;
}

export function canManageSessions(user: User, targetUserId: string): boolean {
  if (!can(user, 'security:manage-sessions')) return false;
  return user.id === targetUserId;
}
