import type { UnsubscribeFunc } from 'pocketbase';
import { getPocketBase } from '@/services/api/pocketbase/client';
import type {
  ChatRealtimeCallback,
  ChatRealtimeEvent,
  ChatRealtimeService,
} from '@/services/chat/realtime';
import {
  mapConversationSubscription,
  mapMemberSubscription,
  mapMessageSubscription,
} from '@/services/chat/realtimeMappers';

type Listener = ChatRealtimeCallback;

export class PocketBaseChatRealtimeService implements ChatRealtimeService {
  private conversationListeners = new Map<string, Set<Listener>>();
  private globalListeners = new Map<string, Set<Listener>>();
  private typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private connectedUserId: string | null = null;
  private connectionId = 0;
  private unsubscribers: UnsubscribeFunc[] = [];

  connect(userId: string): void {
    if (this.connectedUserId === userId && this.unsubscribers.length > 0) return;
    void this.setupSubscriptions(userId);
  }

  disconnect(): void {
    this.connectionId += 1;
    this.connectedUserId = null;

    for (const timer of this.typingTimers.values()) clearTimeout(timer);
    this.typingTimers.clear();

    const pending = this.unsubscribers;
    this.unsubscribers = [];
    for (const unsub of pending) {
      void unsub().catch(() => {});
    }
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
    this.dispatch(event);
  }

  private async setupSubscriptions(userId: string): Promise<void> {
    const pending = this.unsubscribers;
    this.unsubscribers = [];
    for (const unsub of pending) {
      void unsub().catch(() => {});
    }

    this.connectedUserId = userId;
    const activeConnection = ++this.connectionId;
    const pb = getPocketBase();

    try {
      const messageUnsub = await pb.collection('messages').subscribe('*', (sub) => {
        if (activeConnection !== this.connectionId) return;
        const event = mapMessageSubscription(sub);
        if (event) this.dispatch(event);
      });

      if (activeConnection !== this.connectionId) {
        await messageUnsub();
        return;
      }
      this.unsubscribers.push(messageUnsub);

      const conversationUnsub = await pb.collection('conversations').subscribe('*', (sub) => {
        if (activeConnection !== this.connectionId) return;
        const event = mapConversationSubscription(sub);
        if (event) this.dispatch(event);
      });

      if (activeConnection !== this.connectionId) {
        await conversationUnsub();
        return;
      }
      this.unsubscribers.push(conversationUnsub);

      const memberUnsub = await pb.collection('conversation_members').subscribe('*', (sub) => {
        if (activeConnection !== this.connectionId) return;
        const event = mapMemberSubscription(sub);
        if (event) this.dispatch(event);
      });

      if (activeConnection !== this.connectionId) {
        await memberUnsub();
        return;
      }
      this.unsubscribers.push(memberUnsub);
    } catch (error) {
      if (activeConnection === this.connectionId) {
        console.error('[chat-realtime] PocketBase subscription failed', error);
      }
    }
  }

  private dispatch(event: ChatRealtimeEvent): void {
    this.conversationListeners.get(event.conversationId)?.forEach((cb) => cb(event));
    if (this.connectedUserId) {
      this.globalListeners.get(this.connectedUserId)?.forEach((cb) => cb(event));
    }
    for (const listeners of this.globalListeners.values()) {
      listeners.forEach((cb) => cb(event));
    }
  }
}
