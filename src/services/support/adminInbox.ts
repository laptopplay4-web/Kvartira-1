import type { AppNotification, SupportTicket } from '@/types';

/** Admin inbox detail/list routes (not `/profile/help`). */
export function adminHelpTicketPath(ticketId: string): string {
  return `/admin/help/${ticketId}`;
}

export function adminHelpListPath(): string {
  return '/admin/help';
}

export function isAdminHelpTicketPath(pathname: string): boolean {
  return pathname === '/admin/help' || pathname.startsWith('/admin/help/');
}

/** Unanswered requests that need admin attention. */
export function countOpenSupportTickets(
  tickets: Pick<SupportTicket, 'status'>[] | undefined | null,
): number {
  if (!tickets?.length) return 0;
  return tickets.filter((t) => t.status === 'open').length;
}

export function supportTicketAdminNotifyTitle(isReport: boolean): string {
  return isReport ? 'Жалоба на сообщение в чате' : 'Новое обращение в поддержку';
}

/** Unread in-app alerts that link into the admin help inbox. */
export function isSupportAdminNotification(
  n: Pick<AppNotification, 'link'> & Partial<Pick<AppNotification, 'read' | 'type'>>,
): boolean {
  if (!n.link) return false;
  const path = n.link.split('?')[0]?.replace(/\/$/, '') ?? '';
  return path === '/admin/help' || path.startsWith('/admin/help/');
}

export function countUnreadSupportAdminNotifications(
  notifications: (Pick<AppNotification, 'read' | 'link'> &
    Partial<Pick<AppNotification, 'type'>>)[],
): number {
  return notifications.filter((n) => !n.read && isSupportAdminNotification(n)).length;
}
