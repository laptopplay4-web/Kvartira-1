import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { MESSAGE_PAGE_SIZE } from '@/services/chat/constants';
import { compareIsoDates } from '@/utils/dates';
import type { Message } from '@/types';

export function useChatMessages(conversationId: string | undefined, userId: string) {
  return useInfiniteQuery({
    queryKey: ['messages', conversationId, userId],
    queryFn: ({ pageParam }) =>
      api.chat.getMessages(conversationId!, userId, {
        limit: MESSAGE_PAGE_SIZE,
        cursor: pageParam as string | undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => (page.hasMore ? page.nextCursor : undefined),
    enabled: !!conversationId && !!userId,
  });
}

/** Chronological ASC (oldest → newest). Page 0 = newest window; reverse then sort. */
export function flattenMessages(
  pages: { messages: Message[] }[] | undefined,
): Message[] {
  if (!pages?.length) return [];
  const merged = [...pages].reverse().flatMap((p) => p.messages);
  const byKey = new Map<string, Message>();
  for (const m of merged) {
    const key = m.clientMutationId || m.id;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, m);
      continue;
    }
    // Prefer confirmed server message over optimistic / failed placeholder
    const prevRank = messageMergeRank(prev);
    const nextRank = messageMergeRank(m);
    if (nextRank > prevRank) {
      byKey.set(key, m);
    } else if (nextRank === prevRank && m.id !== prev.id && m.status !== 'sending') {
      byKey.set(key, m);
    }
  }
  return [...byKey.values()].sort(
    (a, b) => compareIsoDates(a.createdAt, b.createdAt) || a.id.localeCompare(b.id),
  );
}

function messageMergeRank(m: Message): number {
  if (m.status === 'failed') return 0;
  if (m.status === 'sending') return 1;
  // Real server id (not the optimistic clientMutationId placeholder)
  if (m.clientMutationId && m.id === m.clientMutationId) return 2;
  return 3;
}
