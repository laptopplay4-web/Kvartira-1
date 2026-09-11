import type { AppNotification, User } from '@/types';
import { TEACHER_DIRECTIONS_SETUP_LINK, TEACHER_DIRECTIONS_SETUP_TITLE } from './constants';
import { needsTeacherDirectionSetup } from './access';

export function isTeacherDirectionsSetupNotification(
  n: Pick<AppNotification, 'title' | 'link' | 'urgent'>,
): boolean {
  return (
    n.urgent === true &&
    n.title === TEACHER_DIRECTIONS_SETUP_TITLE &&
    n.link === TEACHER_DIRECTIONS_SETUP_LINK
  );
}

export function hasUnreadTeacherDirectionsSetup(
  notifications: Pick<AppNotification, 'read' | 'title' | 'link' | 'urgent'>[],
): boolean {
  return notifications.some((n) => !n.read && isTeacherDirectionsSetupNotification(n));
}

export { needsTeacherDirectionSetup };

export function shouldPromptTeacherDirections(user: Pick<User, 'role' | 'directionIds'> | null | undefined): boolean {
  return needsTeacherDirectionSetup(user);
}
