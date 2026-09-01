import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

export function useConversationMembers(conversationId: string | undefined, userId: string) {
  return useQuery({
    queryKey: ['members', conversationId, userId],
    queryFn: () => api.chat.getMembers(conversationId!, userId),
    enabled: !!conversationId && !!userId,
  });
}
