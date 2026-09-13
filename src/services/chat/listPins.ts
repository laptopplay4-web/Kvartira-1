const PREFIX = 'chatListPinned:';

export function getLocalPinnedConversationIds(userId: string): string[] {
  try {
    const raw = localStorage.getItem(`${PREFIX}${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function setLocalConversationPinned(userId: string, conversationId: string, pinned: boolean) {
  const current = getLocalPinnedConversationIds(userId).filter((id) => id !== conversationId);
  // Most recently pinned first — used as pin order when server has no pinnedAt
  if (pinned) current.unshift(conversationId);
  localStorage.setItem(`${PREFIX}${userId}`, JSON.stringify(current));
}

/** ISO timestamps for local pins: index 0 = newest pin (first in list). */
export function getLocalPinnedAtMap(userId: string): Map<string, string> {
  const ids = getLocalPinnedConversationIds(userId);
  const map = new Map<string, string>();
  const base = Date.now();
  ids.forEach((id, index) => {
    // Newer pin → larger timestamp so sortConversationsWithPins puts it first
    map.set(id, new Date(base - index).toISOString());
  });
  return map;
}
