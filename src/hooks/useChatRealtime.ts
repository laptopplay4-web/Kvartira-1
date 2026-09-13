import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { chatRealtimeService } from '@/services/chat/realtime';
import type { ChatRealtimeEvent } from '@/services/chat/realtime';
import type { Conversation } from '@/types';
import {
  bumpConversationInList,
  conversationPreviewFromMessage,
} from '@/services/chat/helpers';

export function useChatRealtime(userId: string | undefined, activeConversationId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    chatRealtimeService.connect(userId);

    const handleEvent = (event: ChatRealtimeEvent) => {
      switch (event.type) {
        case 'message.created':
          if (event.message && !event.message.deletedAt) {
            const isOwn = event.message.senderId === userId;
            const isActive = event.conversationId === activeConversationId;
            queryClient.setQueryData<Conversation[]>(['conversations', userId], (old) => {
              if (!old) return old;
              return bumpConversationInList(
                old,
                event.conversationId,
                {
                  lastMessageAt: event.message!.createdAt,
                  lastMessage: conversationPreviewFromMessage(event.message!),
                  unreadDelta: !isOwn && !isActive ? 1 : 0,
                },
                userId,
              );
            });
          }
          queryClient.invalidateQueries({ queryKey: ['messages', event.conversationId] });
          queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
          queryClient.invalidateQueries({ queryKey: ['conversation', event.conversationId, userId] });
          queryClient.invalidateQueries({ queryKey: ['chat-unread', userId] });
          break;
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
