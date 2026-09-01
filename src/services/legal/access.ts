import { can } from '@/permissions';
import type { User, UserConsent } from '@/types';

export function canViewOwnConsents(user: User, targetUserId: string): boolean {
  if (!can(user, 'legal:view-own')) return false;
  return user.id === targetUserId;
}

export function canAcceptDocument(user: User, targetUserId: string): boolean {
  if (!can(user, 'legal:accept')) return false;
  return user.id === targetUserId;
}

export function canManageLegalDocuments(user: User): boolean {
  return can(user, 'legal:manage');
}

export function canViewConsentRecord(user: User, consent: UserConsent): boolean {
  return canViewOwnConsents(user, consent.userId);
}
