import type { AppNotification } from '@/types';

/** v2 — сброс сломанного состояния v1 (только notifications link). */
const VIEWED_STORAGE_PREFIX = 'kvartira:assignmentViewed:v2:';
const SEEDED_STORAGE_PREFIX = 'kvartira:assignmentViewedSeeded:v2:';

/** `/assignments/:id` → id; create/groups/edit ignored. */
export function assignmentIdFromNotificationLink(link?: string): string | null {
  if (!link) return null;
  let path = link.trim();
  try {
    if (/^https?:\/\//i.test(path)) {
      path = new URL(path).pathname;
    }
  } catch {
    /* keep raw */
  }
  const match = /(?:^|\/)assignments\/([^/?#]+)\/?$/.exec(path);
  if (!match?.[1]) return null;
  const id = decodeURIComponent(match[1]);
  if (id === 'create' || id === 'groups') return null;
  return id;
}

function viewedStorageKey(userId: string): string {
  return `${VIEWED_STORAGE_PREFIX}${userId}`;
}

function seededStorageKey(userId: string): string {
  return `${SEEDED_STORAGE_PREFIX}${userId}`;
}

export function getViewedAssignmentIds(userId: string): Set<string> {
  if (typeof localStorage === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(viewedStorageKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0));
  } catch {
    return new Set();
  }
}

function persistViewed(userId: string, ids: Set<string>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(viewedStorageKey(userId), JSON.stringify([...ids]));
  } catch {
    /* ignore quota */
  }
}

export function markAssignmentViewedLocal(userId: string, assignmentId: string): void {
  if (!userId || !assignmentId) return;
  const next = getViewedAssignmentIds(userId);
  if (next.has(assignmentId)) return;
  next.add(assignmentId);
  persistViewed(userId, next);
}

export function isUnreadAssignmentNotification(
  n: Pick<AppNotification, 'read' | 'type' | 'link'>,
): boolean {
  return !n.read && n.type === 'assignment' && assignmentIdFromNotificationLink(n.link) !== null;
}

/** Ids из непрочитанных assignment-уведомлений (+ fallback по title=body). */
export function collectNewAssignmentIdsFromNotifications(
  notifications: Pick<AppNotification, 'read' | 'type' | 'link' | 'body' | 'title'>[],
  assignmentIds: string[],
  assignmentTitles?: Map<string, string>,
): Set<string> {
  const known = new Set(assignmentIds);
  const titleToId = assignmentTitles ?? new Map<string, string>();
  const ids = new Set<string>();

  for (const n of notifications) {
    if (n.read || n.type !== 'assignment') continue;
    const fromLink = assignmentIdFromNotificationLink(n.link);
    if (fromLink && known.has(fromLink)) {
      ids.add(fromLink);
      continue;
    }
    // body при create = title задания
    const title = (n.body || n.title || '').trim();
    if (title && titleToId.has(title)) {
      const id = titleToId.get(title)!;
      if (known.has(id)) ids.add(id);
    }
  }
  return ids;
}

/**
 * Первый заход: помечаем виденными все ДЗ, кроме тех, на которые
 * есть непрочитанное assignment-уведомление (реальные «новые»).
 */
export function ensureAssignmentViewedSeed(
  userId: string,
  assignmentIds: string[],
  notifications: Pick<AppNotification, 'read' | 'type' | 'link' | 'body' | 'title'>[] = [],
  assignmentTitles?: Map<string, string>,
): void {
  if (typeof localStorage === 'undefined' || !userId) return;
  try {
    if (localStorage.getItem(seededStorageKey(userId))) return;
    const keepNew = collectNewAssignmentIdsFromNotifications(
      notifications,
      assignmentIds,
      assignmentTitles,
    );
    const next = getViewedAssignmentIds(userId);
    for (const id of assignmentIds) {
      if (id && !keepNew.has(id)) next.add(id);
    }
    persistViewed(userId, next);
    localStorage.setItem(seededStorageKey(userId), '1');
  } catch {
    /* ignore */
  }
}

/**
 * Непрочитанные = ДЗ из списка, которых ещё не открывали.
 * Сид вызывать только когда загружены и assignments, и notifications
 * (`seed: true`), иначе гонка засидит «новые» до прихода notif.
 */
export function getUnreadAssignmentIds(
  assignmentIds: string[],
  userId: string,
  notifications: Pick<AppNotification, 'read' | 'type' | 'link' | 'body' | 'title'>[] = [],
  assignmentTitles?: Map<string, string>,
  options?: { seed?: boolean },
): Set<string> {
  if (options?.seed) {
    ensureAssignmentViewedSeed(userId, assignmentIds, notifications, assignmentTitles);
  }
  const viewed = getViewedAssignmentIds(userId);
  const unread = new Set<string>();
  for (const id of assignmentIds) {
    if (id && !viewed.has(id)) unread.add(id);
  }
  return unread;
}

export function countUnreadAssignments(
  assignmentIds: string[],
  userId: string,
  notifications: Pick<AppNotification, 'read' | 'type' | 'link' | 'body' | 'title'>[] = [],
  assignmentTitles?: Map<string, string>,
  options?: { seed?: boolean },
): number {
  return getUnreadAssignmentIds(assignmentIds, userId, notifications, assignmentTitles, options)
    .size;
}

export function assignmentDetailPath(assignmentId: string): string {
  return `/assignments/${assignmentId}`;
}
