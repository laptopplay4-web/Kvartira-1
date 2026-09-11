import { can } from '@/permissions';
import type { User } from '@/types';

export function canManageDirections(user: Pick<User, 'role'> | null | undefined): boolean {
  return can(user, 'admin:directions');
}

/** Преподаватель без направлений — нужна срочная настройка после назначения. */
export function needsTeacherDirectionSetup(
  user: Pick<User, 'role' | 'directionIds'> | null | undefined,
): boolean {
  if (!user || user.role !== 'teacher') return false;
  return !user.directionIds?.length;
}
