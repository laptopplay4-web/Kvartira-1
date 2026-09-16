import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { CreateConversationInput } from '@/services/api/types';
import type { Conversation } from '@/types';
import { SCHOOL_WIDE_CHAT_DEFAULT_TITLE } from '@/services/chat/constants';
import { sortConversationsWithPins } from '@/services/chat/helpers';

function optimisticTitle(input: CreateConversationInput): string {
  if (input.type === 'personal') return 'Новый чат';
  if (input.allUsers) return input.title?.trim() || SCHOOL_WIDE_CHAT_DEFAULT_TITLE;
  return input.title?.trim() || 'Новая группа';
}

export function useCreateConversation(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateConversationInput) => api.chat.createConversation(userId, input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['conversations', userId] });
      const previous = queryClient.getQueryData<Conversation[]>(['conversations', userId]);
      const now = new Date().toISOString();
      const optimisticId = `optimistic-${crypto.randomUUID?.() ?? Date.now()}`;
      const participantIds = [...new Set([userId, ...(input.participantIds ?? [])])];
      const optimistic: Conversation = {
        id: optimisticId,
        type: input.type,
        title: optimisticTitle(input),
        participantIds,
        createdAt: now,
        updatedAt: now,
        lastMessageAt: now,
        unreadCount: 0,
        ...(input.avatarUrl ? { avatarUrl: input.avatarUrl } : {}),
        ...(input.allUsers || input.metadata
          ? {
              metadata: {
                ...(input.metadata ?? {}),
                ...(input.allUsers ? { schoolWide: true } : {}),
              },
            }
          : {}),
      };
      queryClient.setQueryData<Conversation[]>(['conversations', userId], (old) =>
        sortConversationsWithPins([optimistic, ...(old ?? [])], [], userId),
      );
      return { previous, optimisticId };
    },
    onSuccess: (conv, _input, ctx) => {
      queryClient.setQueryData<Conversation[]>(['conversations', userId], (old) => {
        const withoutOptimistic = (old ?? []).filter((c) => c.id !== ctx?.optimisticId);
        const withoutDup = withoutOptimistic.filter((c) => c.id !== conv.id);
        return sortConversationsWithPins([conv, ...withoutDup], [], userId);
      });
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(['conversations', userId], ctx.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
      void queryClient.invalidateQueries({ queryKey: ['chat-unread', userId] });
    },
  });
}
