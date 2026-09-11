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
  const current = new Set(getLocalPinnedConversationIds(userId));
  if (pinned) current.add(conversationId);
  else current.delete(conversationId);
  localStorage.setItem(`${PREFIX}${userId}`, JSON.stringify([...current]));
}
