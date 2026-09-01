import { can } from '@/permissions';
import type { SchoolEvent, User } from '@/types';

export function canManageEventsAdmin(user: Pick<User, 'role'> | null | undefined): boolean {
  return !!user && user.role === 'admin' && can(user, 'events:manage');
}

/** Invited events are visible only to users on the invite list (matches mock getEvents/getEvent). */
export function canViewSchoolEvent(
  userId: string,
  event: Pick<SchoolEvent, 'type' | 'invitedUserIds'>,
): boolean {
  if (event.type !== 'invited') return true;
  return event.invitedUserIds?.includes(userId) ?? false;
}

export function canManageSchoolSettings(user: Pick<User, 'role'> | null | undefined): boolean {
  return !!user && user.role === 'admin' && can(user, 'admin:school-settings');
}
