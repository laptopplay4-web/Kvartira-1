import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { Message, MessageAttachment } from '@/types';
import { ApiError } from '@/services/api/types';

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
      await queryClient.cancelQueries({ queryKey: ['messages', conversationId, userId] });
      const previous = queryClient.getQueryData(['messages', conversationId, userId]);

      const optimistic: Message = {
        id: clientMutationId,
        conversationId,
        senderId: userId,
        text: text.trim(),
        createdAt: new Date().toISOString(),
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
        const lastIdx = pages.length - 1;
        if (lastIdx >= 0) {
          pages[lastIdx] = {
            ...pages[lastIdx]!,
            messages: [...pages[lastIdx]!.messages, optimistic],
          };
        } else {
          pages.push({ messages: [optimistic], hasMore: false });
        }
        return { ...data, pages };
      });

      return { previous, clientMutationId };
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
              m.clientMutationId === clientMutationId ? { ...msg, status: 'sent' as const } : m,
            ),
          })),
        };
      });
      queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId, userId] });
      queryClient.invalidateQueries({ queryKey: ['chat-unread', userId] });
    },
    onError: (_err, { conversationId, userId, clientMutationId }) => {
      queryClient.setQueryData(['messages', conversationId, userId], (old: unknown) => {
        if (!old || typeof old !== 'object' || !('pages' in old)) return old;
        const data = old as { pages: { messages: Message[]; hasMore: boolean; nextCursor?: string }[] };
        return {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            messages: page.messages.map((m) =>
              m.clientMutationId === clientMutationId ? { ...m, status: 'failed' as const } : m,
            ),
          })),
        };
      });
    },
    onSettled: (_data, _err, { conversationId, userId }) => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId, userId] });
    },
  });
}

export function createClientMutationId() {
  return uid();
}

export function isOfflineError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'OFFLINE';
}
