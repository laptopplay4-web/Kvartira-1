import { isKnownUserRole } from '@/permissions';
import { isDisplayableAvatarSrc } from '@/services/profile/constants';
import type { AuthSession, User } from '@/types';

export function sanitizePersistedUser(user: User): User {
  const next = { ...user };
  if (!isDisplayableAvatarSrc(next.avatarUrl)) delete next.avatarUrl;
  if (!isDisplayableAvatarSrc(next.avatarOriginalUrl)) delete next.avatarOriginalUrl;
  return next;
}

export function isValidPersistedSession(session: AuthSession | null | undefined): session is AuthSession {
  if (!session?.token || !session.user?.id) return false;
  if (!session.user.phone || !session.user.firstName || !session.user.lastName) return false;
  return isKnownUserRole(session.user.role);
}

export function sanitizePersistedSession(session: AuthSession | null | undefined): AuthSession | null {
  if (!isValidPersistedSession(session)) return null;
  return {
    ...session,
    user: sanitizePersistedUser(session.user),
  };
}
