import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { MESSAGE_PAGE_SIZE } from '@/services/chat/constants';

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

export function flattenMessages(
  pages: { messages: Awaited<ReturnType<typeof api.chat.getMessages>>['messages'] }[] | undefined,
) {
  if (!pages) return [];
  return [...pages].reverse().flatMap((p) => p.messages);
}
