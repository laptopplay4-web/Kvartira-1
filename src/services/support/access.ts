import { can } from '@/permissions';
import type { SupportTicket, User } from '@/types';

export function canViewTicket(user: User, ticket: SupportTicket): boolean {
  if (can(user, 'support:view-all-tickets')) return true;
  if (can(user, 'support:view-own-tickets') && ticket.userId === user.id) return true;
  return false;
}

export function canReplyToTicket(user: User, ticket: SupportTicket): boolean {
  if (!can(user, 'support:reply-ticket')) return false;
  return ticket.status !== 'closed';
}

export function canCreateTicket(user: User): boolean {
  return can(user, 'support:create-ticket');
}

export function canManageFaq(user: User): boolean {
  return can(user, 'support:manage-faq');
}
