import type { HelpArticle, SupportTicket, SupportTicketCategory } from '@/types';
import { TICKET_SEARCH_MIN_LENGTH } from '@/services/support/constants';

export const SUPPORT_CATEGORY_LABELS: Record<SupportTicketCategory, string> = {
  booking: 'Запись на занятия',
  assignments: 'Домашние задания',
  chat: 'Чат',
  technical: 'Техническая проблема',
  other: 'Другое',
};

export const SUPPORT_STATUS_LABELS: Record<SupportTicket['status'], string> = {
  open: 'Открыто',
  answered: 'Получен ответ',
  closed: 'Закрыто',
};

export function filterFaqArticles(articles: HelpArticle[], query: string): HelpArticle[] {
  const q = query.trim().toLowerCase();
  if (!q) return articles;

  return articles.filter((article) => {
    const haystack = [article.question, article.answer, ...article.keywords].join(' ').toLowerCase();
    return haystack.includes(q);
  });
}

export function sortTicketsByDate(tickets: SupportTicket[]): SupportTicket[] {
  return [...tickets].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function filterTickets(
  tickets: SupportTicket[],
  filters: { status?: SupportTicket['status']; category?: SupportTicketCategory },
): SupportTicket[] {
  let list = tickets;
  if (filters.status) {
    list = list.filter((ticket) => ticket.status === filters.status);
  }
  if (filters.category) {
    list = list.filter((ticket) => ticket.category === filters.category);
  }
  return list;
}

export function searchTickets(tickets: SupportTicket[], query: string): SupportTicket[] {
  const q = query.trim().toLowerCase();
  if (!q || q.length < TICKET_SEARCH_MIN_LENGTH) return tickets;

  return tickets.filter((ticket) => {
    const haystack = [
      ticket.subject,
      ticket.message,
      ...ticket.attachments.map((attachment) => attachment.filename),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function parseFaqKeywords(raw: string): string[] {
  return raw
    .split(',')
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}
