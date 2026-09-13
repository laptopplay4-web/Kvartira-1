import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { AppNotification, Conversation } from '@/types';
import {
  isMessageNotificationForChat,
  markChatMessageNotificationsReadInList,
} from '@/services/notifications/helpers';
import { chatRealtimeService } from '@/services/chat/realtime';

/**
 * Открытый чат: сбрасывает unread в списке/бейдже и помечает
 * уведомления `type: message` по этому диалогу как прочитанные.
 * Повторяет при новых сообщениях (realtime / смена last message),
 * иначе бейдж снова появляется до F5.
 */
export function useClearChatSeen(
  conversationId: string | undefined,
  userId: string,
  /** Newest message id in the open thread — re-clear when it changes. */
  latestMessageId?: string | null,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId) {
      void api.chat.setOpenConversation(userId, null);
      return;
    }

    void api.chat.setOpenConversation(userId, conversationId);
    let cancelled = false;

    const clearSeen = () => {
      queryClient.setQueryData<Conversation[]>(['conversations', userId], (old) =>
        old?.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)),
      );

      void (async () => {
        let list = queryClient.getQueryData<AppNotification[]>(['notifications', userId]);
        if (!list) {
          try {
            list = await api.notifications.getNotifications(userId);
            if (cancelled) return;
            queryClient.setQueryData(['notifications', userId], list);
          } catch {
            list = [];
          }
        }
        if (cancelled) return;

        const targets = list.filter(
          (n) => !n.read && isMessageNotificationForChat(n, conversationId),
        );

        if (targets.length > 0) {
          queryClient.setQueryData<AppNotification[]>(['notifications', userId], (old) =>
            old ? markChatMessageNotificationsReadInList(old, conversationId) : old,
          );
        }

        await Promise.all([
          api.chat.markAsRead(conversationId, userId),
          ...targets.map((n) =>
            api.notifications.markAsRead(n.id, userId).catch(() => undefined),
          ),
        ]);
        if (cancelled) return;

        void queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
        void queryClient.invalidateQueries({ queryKey: ['chat-unread', userId] });
        if (targets.length > 0) {
          void queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
        }
      })();
    };

    clearSeen();

    const unsub = chatRealtimeService.subscribe(conversationId, (event) => {
      if (
        event.type === 'message.created' &&
        event.message &&
        event.message.senderId !== userId
      ) {
        clearSeen();
      }
    });

    return () => {
      cancelled = true;
      unsub();
      void api.chat.setOpenConversation(userId, null);
    };
  }, [conversationId, userId, latestMessageId, queryClient]);
}
