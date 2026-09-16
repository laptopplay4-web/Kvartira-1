import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { Conversation } from '@/types';
import {
  clearConversationDeletePending,
  filterDeletedConversations,
  markConversationDeletePending,
} from '@/services/chat/deleteTombstones';
import {
  removeConversationFromList,
  restoreConversationInList,
} from '@/services/chat/helpers';

/**
 * Concurrent-safe conversation delete.
 * Tombstones + per-id rollback — second delete does not wait on the first,
 * and a failed/refetched delete cannot resurrect a sibling that is still deleting.
 */
export function useDeleteConversation(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) => api.chat.deleteConversation(conversationId, userId),
    onMutate: async (conversationId) => {
      markConversationDeletePending(userId, conversationId);
      await queryClient.cancelQueries({ queryKey: ['conversations', userId] });
      const previous = queryClient.getQueryData<Conversation[]>(['conversations', userId]);
      const removed = previous?.find((c) => c.id === conversationId);
      queryClient.setQueryData<Conversation[]>(['conversations', userId], (old) =>
        filterDeletedConversations(userId, old ?? []),
      );
      queryClient.removeQueries({ queryKey: ['conversation', conversationId] });
      queryClient.removeQueries({ queryKey: ['messages', conversationId] });
      queryClient.removeQueries({ queryKey: ['members', conversationId] });
      return { removed };
    },
    onError: (_err, conversationId, ctx) => {
      clearConversationDeletePending(userId, conversationId);
      if (ctx?.removed) {
        queryClient.setQueryData<Conversation[]>(['conversations', userId], (old) =>
          restoreConversationInList(old ?? [], ctx.removed!, userId),
        );
      }
    },
    onSuccess: (_void, conversationId) => {
      queryClient.setQueryData<Conversation[]>(['conversations', userId], (old) =>
        removeConversationFromList(old ?? [], conversationId),
      );
    },
    onSettled: async (_void, error, conversationId) => {
      await queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
      void queryClient.invalidateQueries({ queryKey: ['chat-unread', userId] });
      if (!error) {
        clearConversationDeletePending(userId, conversationId);
      }
    },
  });
}
