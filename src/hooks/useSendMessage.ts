import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { Conversation, Message, MessageAttachment } from '@/types';
import { ApiError } from '@/services/api/types';
import { getAttachmentsPreviewLabel } from '@/services/chat/attachments';
import { bumpConversationInList } from '@/services/chat/helpers';

function uid() {
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface SendMessageVars {
  conversationId: string;
  userId: string;
  text: string;
  clientMutationId: string;
  replyToMessageId?: string;
  attachments?: MessageAttachment[];
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, userId, text, clientMutationId, replyToMessageId, attachments }: SendMessageVars) =>
      api.chat.sendMessage(conversationId, userId, text, {
        clientMutationId,
        suppressNotification: true,
        replyToMessageId,
        attachments,
      }),
    onMutate: async ({ conversationId, userId, text, clientMutationId, replyToMessageId, attachments }) => {
      // Don't await — awaiting in-flight refetches delays the optimistic bubble.
      void queryClient.cancelQueries({ queryKey: ['messages', conversationId, userId] });
      void queryClient.cancelQueries({ queryKey: ['conversations', userId] });
      const previous = queryClient.getQueryData(['messages', conversationId, userId]);
      const previousConversations = queryClient.getQueryData<Conversation[]>(['conversations', userId]);

      const createdAt = new Date().toISOString();
      const optimistic: Message = {
        id: clientMutationId,
        conversationId,
        senderId: userId,
        text: text.trim(),
        createdAt,
        status: 'sending',
        readBy: [userId],
        clientMutationId,
        replyToMessageId,
        attachments,
        messageType: 'user',
      };

      queryClient.setQueryData(['messages', conversationId, userId], (old: unknown) => {
        if (!old || typeof old !== 'object' || !('pages' in old)) return old;
        const data = old as { pages: { messages: Message[]; hasMore: boolean; nextCursor?: string }[] };
        const pages = [...data.pages];
        // Page 0 = newest window — append new messages there (not to last/oldest page)
        if (pages.length === 0) {
          pages.push({ messages: [optimistic], hasMore: false });
        } else {
          pages[0] = {
            ...pages[0]!,
            messages: [...pages[0]!.messages, optimistic],
          };
        }
        return { ...data, pages };
      });

      const previewText =
        text.trim() || getAttachmentsPreviewLabel(attachments) || 'Вложение';
      queryClient.setQueryData<Conversation[]>(['conversations', userId], (old) => {
        if (!old) return old;
        return bumpConversationInList(
          old,
          conversationId,
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

      return { previous, previousConversations, clientMutationId };
    },
    onSuccess: (msg, { conversationId, userId, clientMutationId }) => {
      queryClient.setQueryData(['messages', conversationId, userId], (old: unknown) => {
        if (!old || typeof old !== 'object' || !('pages' in old)) return old;
        const data = old as { pages: { messages: Message[]; hasMore: boolean; nextCursor?: string }[] };
        return {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            messages: page.messages.map((m) =>
              m.clientMutationId === clientMutationId || m.id === clientMutationId
                ? { ...msg, status: 'sent' as const, clientMutationId }
                : m,
            ),
          })),
        };
      });
      queryClient.setQueryData<Conversation[]>(['conversations', userId], (old) => {
        if (!old) return old;
        return bumpConversationInList(
          old,
          conversationId,
          {
            lastMessageAt: msg.createdAt,
            lastMessage: {
              id: msg.id,
              text:
                msg.text ||
                getAttachmentsPreviewLabel(msg.attachments) ||
                'Вложение',
              senderId: msg.senderId,
              createdAt: msg.createdAt,
            },
          },
          userId,
        );
      });
      queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId, userId] });
      queryClient.invalidateQueries({ queryKey: ['chat-unread', userId] });
    },
    onError: (_err, { conversationId, userId, clientMutationId }, ctx) => {
      if (ctx?.previousConversations) {
        queryClient.setQueryData(['conversations', userId], ctx.previousConversations);
      }
      queryClient.setQueryData(['messages', conversationId, userId], (old: unknown) => {
        if (!old || typeof old !== 'object' || !('pages' in old)) return old;
        const data = old as { pages: { messages: Message[]; hasMore: boolean; nextCursor?: string }[] };
        return {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            messages: page.messages.map((m) => {
              if (m.clientMutationId !== clientMutationId && m.id !== clientMutationId) return m;
              // Never downgrade a server-confirmed message to failed (race with
              // realtime refetch after create + failed post-create side-effect).
              if (m.status === 'sending' || m.id === clientMutationId) {
                return { ...m, status: 'failed' as const };
              }
              return m;
            }),
          })),
        };
      });
    },
    onSettled: (_data, err, { conversationId, userId }) => {
      // Success path already patched the cache; refetch only on error to recover
      // if the message actually landed on the server.
      if (err) {
        queryClient.invalidateQueries({ queryKey: ['messages', conversationId, userId] });
        queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
      }
    },
  });
}

export function createClientMutationId() {
  return uid();
}

export function isOfflineError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'OFFLINE';
}
