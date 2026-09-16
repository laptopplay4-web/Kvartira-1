import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { CreateConversationInput } from '@/services/api/types';
import type { Conversation } from '@/types';
import {
  buildOptimisticConversation,
  createOptimisticConversationId,
  prependOptimisticConversation,
  replaceOptimisticConversationInList,
} from '@/services/chat/helpers';

export type CreateConversationVars = CreateConversationInput & {
  /** Optional list-row title while create is in flight (e.g. student name). */
  displayTitle?: string;
};

export function useCreateConversation(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ displayTitle: _displayTitle, ...input }: CreateConversationVars) =>
      api.chat.createConversation(userId, input),
    onMutate: async (vars) => {
      const { displayTitle, ...input } = vars;
      await queryClient.cancelQueries({ queryKey: ['conversations', userId] });
      const previous = queryClient.getQueryData<Conversation[]>(['conversations', userId]);
      const tempId = createOptimisticConversationId();
      const optimistic = buildOptimisticConversation(userId, tempId, input, displayTitle);
      queryClient.setQueryData<Conversation[]>(['conversations', userId], (old) =>
        prependOptimisticConversation(old ?? [], optimistic, userId),
      );
      return { previous, tempId };
    },
    onSuccess: (conv, _vars, context) => {
      queryClient.setQueryData<Conversation[]>(['conversations', userId], (old) => {
        if (!old) return [conv];
        if (!context?.tempId) return old;
        return replaceOptimisticConversationInList(old, context.tempId, conv, userId);
      });
    },
    onError: (_error, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(['conversations', userId], context.previous);
      }
    },
  });
}
