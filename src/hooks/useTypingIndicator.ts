import { useEffect, useRef, useState } from 'react';
import { api } from '@/services/api';
import { chatRealtimeService } from '@/services/chat/realtime';
import type { ChatRealtimeEvent } from '@/services/chat/realtime';
import { formatTypingIndicator } from '@/services/chat/helpers';
import type { User } from '@/types';
import { formatUserName } from '@/utils';

export function useTypingIndicator(
  conversationId: string | undefined,
  currentUserId: string,
  users: User[],
) {
  const [typingUserIds, setTypingUserIds] = useState<Set<string>>(new Set());
  const typingRef = useRef(typingUserIds);
  typingRef.current = typingUserIds;

  useEffect(() => {
    if (!conversationId) return;

    const unsub = chatRealtimeService.subscribe(conversationId, (event: ChatRealtimeEvent) => {
      if (event.type === 'typing.started' && event.typingUser) {
        const { userId } = event.typingUser;
        if (userId === currentUserId) return;
        setTypingUserIds((prev) => new Set([...prev, userId]));
      }
      if (event.type === 'typing.stopped' && event.userId) {
        setTypingUserIds((prev) => {
          const next = new Set(prev);
          next.delete(event.userId!);
          return next;
        });
      }
    });

    return unsub;
  }, [conversationId, currentUserId]);

  const names = [...typingUserIds]
    .map((id) => users.find((u) => u.id === id))
    .filter(Boolean)
    .map((u) => formatUserName(u!));

  return {
    typingText: formatTypingIndicator(names),
    isTyping: names.length > 0,
  };
}

let typingTimer: ReturnType<typeof setTimeout> | null = null;
let lastSent = 0;

export function notifyTyping(conversationId: string, userId: string) {
  const now = Date.now();
  if (now - lastSent < 2000) return;
  lastSent = now;
  api.chat.sendTyping(conversationId, userId, true).catch(() => {});
  if (typingTimer) clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    api.chat.sendTyping(conversationId, userId, false).catch(() => {});
  }, 3000);
}
