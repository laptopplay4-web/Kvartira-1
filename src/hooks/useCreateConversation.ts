import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { CreateConversationInput } from '@/services/api/types';

export function useCreateConversation(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateConversationInput) => api.chat.createConversation(userId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
    },
  });
}
