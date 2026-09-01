import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { Message } from '@/types';
import { DELETED_MESSAGE_TEXT } from '@/services/chat/messages';

export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      conversationId,
      messageId,
      userId,
    }: {
      conversationId: string;
      messageId: string;
      userId: string;
    }) => api.chat.deleteMessage(conversationId, messageId, userId),
    onMutate: async ({ conversationId, userId, messageId }) => {
      await queryClient.cancelQueries({ queryKey: ['messages', conversationId, userId] });
      const previous = queryClient.getQueryData(['messages', conversationId, userId]);
      const now = new Date().toISOString();

      queryClient.setQueryData(['messages', conversationId, userId], (old: unknown) => {
        if (!old || typeof old !== 'object' || !('pages' in old)) return old;
        const data = old as { pages: { messages: Message[] }[] };
        return {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            messages: page.messages.map((m) =>
              m.id === messageId
                ? { ...m, text: DELETED_MESSAGE_TEXT, deletedAt: now, updatedAt: now }
                : m,
            ),
          })),
        };
      });

      return { previous };
    },
    onError: (_err, { conversationId, userId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['messages', conversationId, userId], context.previous);
      }
    },
    onSettled: (_data, _err, { conversationId, userId }) => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId, userId] });
      queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
      queryClient.invalidateQueries({ queryKey: ['chat-unread', userId] });
    },
  });
}
