import type { Direction } from '@/types';
import type { AppNotification } from '@/types';
import {
  TEACHER_DIRECTIONS_SETUP_BODY,
  TEACHER_DIRECTIONS_SETUP_LINK,
  TEACHER_DIRECTIONS_SETUP_TITLE,
} from '@/services/directions/constants';
import { hasUnreadTeacherDirectionsSetup } from '@/services/directions/helpers';
import { needsTeacherDirectionSetup } from '@/services/directions/access';
import type { User } from '@/types';

type PushFn = (
  userId: string,
  type: 'system',
  title: string,
  body: string,
  link?: string,
  urgent?: boolean,
) => void;

/** При входе преподавателя без направлений — срочное уведомление (если ещё нет непрочитанного). */
export function ensureTeacherDirectionsSetupNotification(
  user: Pick<User, 'id' | 'role' | 'directionIds'>,
  notifications: Pick<AppNotification, 'read' | 'title' | 'link' | 'urgent'>[],
  push: PushFn,
): boolean {
  if (!needsTeacherDirectionSetup(user)) return false;
  if (hasUnreadTeacherDirectionsSetup(notifications)) return false;
  push(
    user.id,
    'system',
    TEACHER_DIRECTIONS_SETUP_TITLE,
    TEACHER_DIRECTIONS_SETUP_BODY,
    TEACHER_DIRECTIONS_SETUP_LINK,
    true,
  );
  return true;
}

export function markTeacherDirectionsSetupNotificationsRead(
  notifications: AppNotification[],
  userId: string,
): void {
  for (const n of notifications) {
    if (
      n.userId === userId &&
      !n.read &&
      n.urgent &&
      n.title === TEACHER_DIRECTIONS_SETUP_TITLE &&
      n.link === TEACHER_DIRECTIONS_SETUP_LINK
    ) {
      n.read = true;
    }
  }
}

export function findDirectionById(list: Direction[], id: string): Direction | undefined {
  return list.find((d) => d.id === id);
}
