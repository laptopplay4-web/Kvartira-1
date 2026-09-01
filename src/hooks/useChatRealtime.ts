import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { chatRealtimeService } from '@/services/chat/realtime';
import type { ChatRealtimeEvent } from '@/services/chat/realtime';

export function useChatRealtime(userId: string | undefined, activeConversationId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    chatRealtimeService.connect(userId);

    const handleEvent = (event: ChatRealtimeEvent) => {
      switch (event.type) {
        case 'message.created':
        case 'message.updated':
        case 'message.deleted':
          queryClient.invalidateQueries({ queryKey: ['messages', event.conversationId] });
          queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
          queryClient.invalidateQueries({ queryKey: ['conversation', event.conversationId, userId] });
          queryClient.invalidateQueries({ queryKey: ['chat-unread', userId] });
          break;
        case 'message.read':
        case 'conversation.updated':
        case 'member.joined':
        case 'member.left':
          queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
          if (event.conversationId) {
            queryClient.invalidateQueries({ queryKey: ['conversation', event.conversationId, userId] });
            queryClient.invalidateQueries({ queryKey: ['members', event.conversationId, userId] });
          }
          break;
        default:
          break;
      }
    };

    const unsubGlobal = chatRealtimeService.subscribeGlobal(userId, handleEvent);
    const unsubConv = activeConversationId
      ? chatRealtimeService.subscribe(activeConversationId, handleEvent)
      : () => {};

    return () => {
      unsubGlobal();
      unsubConv();
      chatRealtimeService.disconnect();
    };
  }, [userId, activeConversationId, queryClient]);
}
