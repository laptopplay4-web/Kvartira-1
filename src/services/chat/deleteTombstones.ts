/** In-flight conversation deletes — keeps optimistic removals across parallel mutates + refetches. */

const pendingByUser = new Map<string, Set<string>>();

export function markConversationDeletePending(userId: string, conversationId: string): void {
  let set = pendingByUser.get(userId);
  if (!set) {
    set = new Set();
    pendingByUser.set(userId, set);
  }
  set.add(conversationId);
}

export function clearConversationDeletePending(userId: string, conversationId: string): void {
  pendingByUser.get(userId)?.delete(conversationId);
}

export function isConversationDeletePending(userId: string, conversationId: string): boolean {
  return pendingByUser.get(userId)?.has(conversationId) ?? false;
}

export function filterDeletedConversations<T extends { id: string }>(
  userId: string,
  conversations: T[],
): T[] {
  const set = pendingByUser.get(userId);
  if (!set?.size) return conversations;
  return conversations.filter((c) => !set.has(c.id));
}

/** Test / reset helper */
export function clearAllConversationDeletePending(): void {
  pendingByUser.clear();
}
