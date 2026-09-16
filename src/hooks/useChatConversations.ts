import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { filterDeletedConversations } from '@/services/chat/deleteTombstones';

export function useChatConversations(userId: string) {
  return useQuery({
    queryKey: ['conversations', userId],
    queryFn: async () => {
      const list = await api.chat.getConversations(userId);
      return filterDeletedConversations(userId, list);
    },
    enabled: !!userId,
  });
}

export function useChatConversation(conversationId: string | undefined, userId: string) {
  return useQuery({
    queryKey: ['conversation', conversationId, userId],
    queryFn: () => api.chat.getConversation(conversationId!, userId),
    enabled: !!conversationId && !!userId,
    retry: false,
  });
}

export function useChatUnreadTotal(userId: string) {
  return useQuery({
    queryKey: ['chat-unread', userId],
    queryFn: () => api.chat.getTotalUnread(userId),
    enabled: !!userId,
  });
}
