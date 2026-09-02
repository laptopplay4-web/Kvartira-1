import { can } from '@/permissions';
import type { SchoolEvent, User } from '@/types';

/** Teacher and admin can create/edit/delete school events (UI: `/events`). */
export function canManageEvents(user: Pick<User, 'role'> | null | undefined): boolean {
  return can(user, 'events:manage');
}

/** @deprecated use canManageEvents — same rule (teacher + admin). */
export function canManageEventsAdmin(user: Pick<User, 'role'> | null | undefined): boolean {
  return canManageEvents(user);
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
