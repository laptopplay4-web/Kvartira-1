import type { AppNotification } from '@/types';

const EVENTS_TAB_SEEN_PREFIX = 'kvartira:eventsTabSeen:';
const EVENT_CARD_SEEN_PREFIX = 'kvartira:eventCardSeen:';

export type EventParticipationChange = 'join' | 'leave';

export interface EventParticipationUnreadDelta {
  joins: number;
  leaves: number;
}

export function eventIdFromNotificationLink(link?: string): string | null {
  if (!link) return null;
  const match = /^\/events\/([^/?#]+)/.exec(link.trim());
  return match?.[1] ?? null;
}

/** Ссылка staff-уведомления о записи / отмене (participant id + change). */
export function eventParticipationNotifyLink(
  eventId: string,
  participantId: string,
  change: EventParticipationChange,
): string {
  const params = new URLSearchParams({ p: participantId, c: change });
  return `/events/${eventId}?${params.toString()}`;
}

export function parseEventParticipationLink(link?: string): {
  eventId: string;
  participantId: string | null;
  change: EventParticipationChange | null;
} | null {
  if (!link) return null;
  const pathMatch = /^\/events\/([^/?#]+)/.exec(link.trim());
  if (!pathMatch) return null;

  let participantId: string | null = null;
  let change: EventParticipationChange | null = null;
  const qIndex = link.indexOf('?');
  if (qIndex >= 0) {
    const qs = link.slice(qIndex + 1).split('#')[0] ?? '';
    const params = new URLSearchParams(qs);
    const p = params.get('p');
    const c = params.get('c');
    if (p) participantId = p;
    if (c === 'join' || c === 'leave') change = c;
  }

  return { eventId: pathMatch[1]!, participantId, change };
}

/** join/leave для staff; «Новое мероприятие» и прочее → null. */
export function classifyEventParticipationNotification(
  n: Pick<AppNotification, 'read' | 'type' | 'link'> &
    Partial<Pick<AppNotification, 'title'>>,
): EventParticipationChange | null {
  if (n.read || n.type !== 'event') return null;
  const parsed = parseEventParticipationLink(n.link);
  if (!parsed) return null;
  if (parsed.change) return parsed.change;

  const title = n.title?.trim() ?? '';
  const titleLower = title.toLowerCase();
  if (title === 'Новая запись на мероприятие' || title === 'Новая запись') return 'join';
  if (
    title === 'Отмена участия в мероприятии' ||
    title === 'Участник удалён с мероприятия' ||
    titleLower.includes('отмена участия') ||
    titleLower.includes('удалён') ||
    titleLower.includes('удален')
  ) {
    return 'leave';
  }
  return null;
}

export function isUnreadEventParticipationNotification(
  n: Pick<AppNotification, 'read' | 'type' | 'link'>,
): boolean {
  return !n.read && n.type === 'event' && eventIdFromNotificationLink(n.link) !== null;
}

export function getEventsTabSeenAt(userId: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(`${EVENTS_TAB_SEEN_PREFIX}${userId}`);
  } catch {
    return null;
  }
}

export function markEventsTabSeen(userId: string, at = new Date().toISOString()): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(`${EVENTS_TAB_SEEN_PREFIX}${userId}`, at);
  } catch {
    /* ignore quota */
  }
}

function eventCardSeenKey(userId: string, eventId: string): string {
  return `${EVENT_CARD_SEEN_PREFIX}${userId}:${eventId}`;
}

/** Открытие деталки (не списка участников) — снимает подсветку карточки. */
export function getEventCardSeenAt(userId: string, eventId: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(eventCardSeenKey(userId, eventId));
  } catch {
    return null;
  }
}

export function markEventCardSeen(
  userId: string,
  eventId: string,
  at = new Date().toISOString(),
): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(eventCardSeenKey(userId, eventId), at);
  } catch {
    /* ignore quota */
  }
}

/**
 * Бейдж на иконке «События»: непрочитанные event-уведомления.
 * Staff: новее визита вкладки (записи учеников).
 * Ученик: все unread до открытия мероприятия (ignoreTabSeen).
 */
export function countUnreadEventParticipationsForNav(
  notifications: Pick<AppNotification, 'read' | 'type' | 'link' | 'createdAt'>[],
  userId: string,
  options?: { ignoreTabSeen?: boolean },
): number {
  const seenAt = options?.ignoreTabSeen ? null : getEventsTabSeenAt(userId);
  let count = 0;
  for (const n of notifications) {
    if (!isUnreadEventParticipationNotification(n)) continue;
    if (seenAt && n.createdAt <= seenAt) continue;
    count += 1;
  }
  return count;
}

/** Все unread event по мероприятию (ученик: новое событие; legacy). */
export function countUnreadForEvent(
  notifications: Pick<AppNotification, 'read' | 'type' | 'link'>[],
  eventId: string,
): number {
  let count = 0;
  for (const n of notifications) {
    if (!isUnreadEventParticipationNotification(n)) continue;
    if (eventIdFromNotificationLink(n.link) === eventId) count += 1;
  }
  return count;
}

/** Staff: отдельно +записи и −отмены по мероприятию. */
export function summarizeUnreadParticipationDelta(
  notifications: (Pick<AppNotification, 'read' | 'type' | 'link'> &
    Partial<Pick<AppNotification, 'title'>>)[],
  eventId: string,
): EventParticipationUnreadDelta {
  let joins = 0;
  let leaves = 0;
  for (const n of notifications) {
    const change = classifyEventParticipationNotification(n);
    if (!change) continue;
    if (eventIdFromNotificationLink(n.link) !== eventId) continue;
    if (change === 'join') joins += 1;
    else leaves += 1;
  }
  return { joins, leaves };
}

export function getUnreadParticipationParticipantIds(
  notifications: (Pick<AppNotification, 'read' | 'type' | 'link'> &
    Partial<Pick<AppNotification, 'title'>>)[],
  eventId: string,
  change: EventParticipationChange,
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const n of notifications) {
    if (classifyEventParticipationNotification(n) !== change) continue;
    const parsed = parseEventParticipationLink(n.link);
    if (!parsed || parsed.eventId !== eventId || !parsed.participantId) continue;
    if (seen.has(parsed.participantId)) continue;
    seen.add(parsed.participantId);
    ids.push(parsed.participantId);
  }
  return ids;
}

/**
 * Подсветка карточки в списке: есть unread новее последнего открытия деталки.
 * После открытия деталки подсветка гаснет; бейджи участников остаются до Sheet close.
 */
export function shouldHighlightEventCard(
  notifications: (Pick<AppNotification, 'read' | 'type' | 'link' | 'createdAt'> &
    Partial<Pick<AppNotification, 'title'>>)[],
  userId: string,
  eventId: string,
): boolean {
  const cardSeenAt = getEventCardSeenAt(userId, eventId);
  for (const n of notifications) {
    if (!isUnreadEventParticipationNotification(n)) continue;
    if (eventIdFromNotificationLink(n.link) !== eventId) continue;
    // Staff card: только join/leave; без title — считаем участием (legacy).
    const change = classifyEventParticipationNotification(n);
    if (n.title && change === null) continue;
    if (cardSeenAt && n.createdAt <= cardSeenAt) continue;
    return true;
  }
  return false;
}

export function eventDetailPath(eventId: string): string {
  return `/events/${eventId}`;
}
