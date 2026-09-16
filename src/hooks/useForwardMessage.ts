import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { Conversation, Message } from '@/types';
import {
  bumpConversationInList,
  conversationPreviewFromMessage,
} from '@/services/chat/helpers';
import {
  upsertMessageInInfiniteCache,
  type MessagesInfiniteData,
} from '@/services/chat/messageCache';
import { getAttachmentsPreviewLabel } from '@/services/chat/attachments';
import { createClientMutationId } from '@/hooks/useSendMessage';

export interface ForwardMessageVars {
  sourceConversationId: string;
  messageId: string;
  userId: string;
  targetConversationId: string;
  /** Snapshot for optimistic UI (source may leave cache while request is in flight). */
  sourceMessage: Message;
}

export function useForwardMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sourceConversationId,
      messageId,
      userId,
      targetConversationId,
    }: ForwardMessageVars) =>
      api.chat.forwardMessage(sourceConversationId, messageId, userId, targetConversationId),
    onMutate: async ({ userId, targetConversationId, sourceMessage }) => {
      void queryClient.cancelQueries({ queryKey: ['messages', targetConversationId, userId] });
      void queryClient.cancelQueries({ queryKey: ['conversations', userId] });

      const previousMessages = queryClient.getQueryData<MessagesInfiniteData>([
        'messages',
        targetConversationId,
        userId,
      ]);
      const previousConversations = queryClient.getQueryData<Conversation[]>([
        'conversations',
        userId,
      ]);

      const clientMutationId = createClientMutationId();
      const createdAt = new Date().toISOString();
      const optimistic: Message = {
        id: clientMutationId,
        conversationId: targetConversationId,
        senderId: userId,
        text: sourceMessage.text.trim(),
        createdAt,
        status: 'sending',
        readBy: [userId],
        clientMutationId,
        attachments: sourceMessage.attachments,
        messageType: 'user',
      };

      queryClient.setQueryData<MessagesInfiniteData>(
        ['messages', targetConversationId, userId],
        (old) => upsertMessageInInfiniteCache(old, optimistic),
      );

      const previewText =
        sourceMessage.text.trim() ||
        getAttachmentsPreviewLabel(sourceMessage.attachments) ||
        'Вложение';
      queryClient.setQueryData<Conversation[]>(['conversations', userId], (old) => {
        if (!old) return old;
        return bumpConversationInList(
          old,
          targetConversationId,
          {
            lastMessageAt: createdAt,
            lastMessage: {
              id: clientMutationId,
              text: previewText,
              senderId: userId,
              createdAt,
            },
          },
          userId,
        );
      });

      return { previousMessages, previousConversations, clientMutationId };
    },
    onSuccess: (msg, { userId, targetConversationId }, ctx) => {
      const confirmed = {
        ...msg,
        status: 'sent' as const,
        clientMutationId: ctx?.clientMutationId,
      };
      queryClient.setQueryData<MessagesInfiniteData>(
        ['messages', targetConversationId, userId],
        (old) => upsertMessageInInfiniteCache(old, confirmed),
      );
      queryClient.setQueryData<Conversation[]>(['conversations', userId], (old) => {
        if (!old) return old;
        return bumpConversationInList(
          old,
          targetConversationId,
          {
            lastMessageAt: msg.createdAt,
            lastMessage: conversationPreviewFromMessage(confirmed),
          },
          userId,
        );
      });
      void queryClient.invalidateQueries({ queryKey: ['chat-unread', userId] });
    },
    onError: (_err, { userId, targetConversationId }, ctx) => {
      if (ctx?.previousConversations) {
        queryClient.setQueryData(['conversations', userId], ctx.previousConversations);
      }
      if (ctx?.previousMessages) {
        queryClient.setQueryData(
          ['messages', targetConversationId, userId],
          ctx.previousMessages,
        );
      } else {
        queryClient.invalidateQueries({
          queryKey: ['messages', targetConversationId, userId],
        });
        queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
      }
    },
  });
}
