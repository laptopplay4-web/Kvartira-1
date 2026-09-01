import type { Conversation, Message, TypingUser } from '@/types';

export type ChatRealtimeEventType =
  | 'message.created'
  | 'message.updated'
  | 'message.deleted'
  | 'message.read'
  | 'typing.started'
  | 'typing.stopped'
  | 'member.joined'
  | 'member.left'
  | 'conversation.updated';

export interface ChatRealtimeEvent {
  type: ChatRealtimeEventType;
  conversationId: string;
  message?: Message;
  conversation?: Conversation;
  typingUser?: TypingUser;
  userId?: string;
}

export type ChatRealtimeCallback = (event: ChatRealtimeEvent) => void;

export interface ChatRealtimeService {
  subscribe(conversationId: string, callback: ChatRealtimeCallback): () => void;
  subscribeGlobal(userId: string, callback: ChatRealtimeCallback): () => void;
  connect(userId: string): void;
  disconnect(): void;
  sendTyping(conversationId: string, userId: string, isTyping: boolean): void;
  emit(event: ChatRealtimeEvent): void;
}

type Listener = ChatRealtimeCallback;

class MockChatRealtimeService implements ChatRealtimeService {
  private conversationListeners = new Map<string, Set<Listener>>();
  private globalListeners = new Map<string, Set<Listener>>();
  private typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private connectedUserId: string | null = null;

  connect(userId: string): void {
    this.connectedUserId = userId;
  }

  disconnect(): void {
    this.connectedUserId = null;
    for (const timer of this.typingTimers.values()) clearTimeout(timer);
    this.typingTimers.clear();
  }

  subscribe(conversationId: string, callback: ChatRealtimeCallback): () => void {
    if (!this.conversationListeners.has(conversationId)) {
      this.conversationListeners.set(conversationId, new Set());
    }
    this.conversationListeners.get(conversationId)!.add(callback);
    return () => {
      this.conversationListeners.get(conversationId)?.delete(callback);
    };
  }

  subscribeGlobal(userId: string, callback: ChatRealtimeCallback): () => void {
    if (!this.globalListeners.has(userId)) {
      this.globalListeners.set(userId, new Set());
    }
    this.globalListeners.get(userId)!.add(callback);
    return () => {
      this.globalListeners.get(userId)?.delete(callback);
    };
  }

  sendTyping(conversationId: string, userId: string, isTyping: boolean): void {
    const key = `${conversationId}:${userId}`;
    const existing = this.typingTimers.get(key);
    if (existing) clearTimeout(existing);

    if (isTyping) {
      this.emit({
        type: 'typing.started',
        conversationId,
        typingUser: { userId, conversationId, startedAt: new Date().toISOString() },
      });
      const timer = setTimeout(() => {
        this.emit({
          type: 'typing.stopped',
          conversationId,
          userId,
        });
        this.typingTimers.delete(key);
      }, 5000);
      this.typingTimers.set(key, timer);
    } else {
      this.emit({ type: 'typing.stopped', conversationId, userId });
      this.typingTimers.delete(key);
    }
  }

  emit(event: ChatRealtimeEvent): void {
    this.conversationListeners.get(event.conversationId)?.forEach((cb) => cb(event));
    if (this.connectedUserId) {
      this.globalListeners.get(this.connectedUserId)?.forEach((cb) => cb(event));
    }
    for (const listeners of this.globalListeners.values()) {
      listeners.forEach((cb) => cb(event));
    }
  }
}

import { isPocketBaseMode } from '@/services/api/pocketbase/client';
import { PocketBaseChatRealtimeService } from '@/services/chat/realtimePocketbase';

function createChatRealtimeService(): ChatRealtimeService {
  if (isPocketBaseMode()) {
    return new PocketBaseChatRealtimeService();
  }
  return new MockChatRealtimeService();
}

export const chatRealtimeService: ChatRealtimeService = createChatRealtimeService();
