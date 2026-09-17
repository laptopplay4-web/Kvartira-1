import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
} from 'react';
import type { Conversation, ConversationMember, Message, User } from '@/types';
import {
  buildMessageListWithSeparators,
  resolvePinnedIndexForViewport,
} from '@/services/chat/helpers';
import {
  CHAT_NEAR_BOTTOM_PX,
  isNearBottom,
  scrollElementToBottom,
} from '@/services/chat/scroll';
import { formatChatDateSeparator } from '@/utils/dates';
import { MessageBubble } from './MessageBubble';
import { SystemMessage } from './SystemMessage';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { MessageCircle, ChevronDown } from 'lucide-react';
import { cn } from '@/utils';

export interface MessageListHandle {
  scrollToMessage: (messageId: string) => void;
  scrollToBottom: () => void;
}

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  user: User;
  users: User[];
  /** Remount/pin key — when it changes, jump to latest message. */
  conversationId?: string;
  isGroup?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  hasMore?: boolean;
  isFetchingMore?: boolean;
  onRetry?: () => void;
  onLoadMore?: () => void;
  onRetryMessage?: (message: Message) => void;
  onReply?: (message: Message) => void;
  onEdit?: (message: Message) => void;
  onDelete?: (message: Message, scope: 'me' | 'everyone') => void;
  onReport?: (message: Message) => void;
  onForward?: (message: Message) => void;
  onReact?: (message: Message, emoji: string) => void;
  onPin?: (message: Message) => void;
  onImageClick?: (message: Message, index: number) => void;
  onDragDrop?: (files: FileList) => void;
  highlightMessageId?: string | null;
  highlightVariant?: 'brand' | 'report';
  /** When true, skip initial jump-to-bottom (report / msg deep-link). */
  preserveDeepLinkScroll?: boolean;
  conversation?: Conversation | null;
  members?: ConversationMember[];
  /** Newest → oldest pin ids; drives Telegram-style pin bar sync on scroll. */
  pinnedIdsNewestFirst?: string[];
  onPinnedIndexChange?: (index: number) => void;
  /** Fired on real user scroll intent (wheel/touch/scrollbar), not programmatic. */
  onPinnedScrollResume?: () => void;
}

export const MessageList = forwardRef<MessageListHandle, MessageListProps>(function MessageList(
  {
    messages,
    currentUserId,
    user,
    users,
    conversationId,
    isGroup,
    isLoading,
    isError,
    hasMore,
    isFetchingMore,
    onRetry,
    onLoadMore,
    onRetryMessage,
    onReply,
    onEdit,
    onDelete,
    onReport,
    onForward,
    onReact,
    onPin,
    onImageClick,
    onDragDrop,
    highlightMessageId,
    highlightVariant = 'brand',
    preserveDeepLinkScroll = false,
    conversation,
    members,
    pinnedIdsNewestFirst,
    onPinnedIndexChange,
    onPinnedScrollResume,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showNewIndicator, setShowNewIndicator] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const prevCountRef = useRef(0);
  const prevScrollHeightRef = useRef(0);
  const loadingMoreRef = useRef(false);
  /** Stick to latest while user is at bottom (open + image layout growth). */
  const stickToBottomRef = useRef(!preserveDeepLinkScroll);
  const pinSyncRafRef = useRef(0);
  const lastEmittedPinIndexRef = useRef<number | null>(null);
  const pinnedIdsRef = useRef(pinnedIdsNewestFirst);
  const onPinnedIndexChangeRef = useRef(onPinnedIndexChange);
  pinnedIdsRef.current = pinnedIdsNewestFirst;
  onPinnedIndexChangeRef.current = onPinnedIndexChange;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = containerRef.current;
    if (!el) return;
    stickToBottomRef.current = true;
    scrollElementToBottom(el, behavior);
  }, []);

  const scrollToMessage = useCallback(
    (messageId: string) => {
      const el = document.getElementById(`message-${messageId}`);
      if (el) {
        stickToBottomRef.current = false;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return true;
      }
      return false;
    },
    [],
  );

  useImperativeHandle(ref, () => ({
    scrollToMessage: (messageId: string) => {
      if (!scrollToMessage(messageId) && hasMore) {
        onLoadMore?.();
      }
    },
    scrollToBottom: () => scrollToBottom(),
  }));

  const hasMessages = messages.length > 0;

  // Open / switch conversation / leave loading → pin to latest before paint.
  useLayoutEffect(() => {
    if (preserveDeepLinkScroll) {
      stickToBottomRef.current = false;
      return;
    }
    if (isLoading || !hasMessages) return;
    stickToBottomRef.current = true;
    prevCountRef.current = messages.length;
    scrollToBottom('instant');
  }, [conversationId, isLoading, hasMessages, preserveDeepLinkScroll, scrollToBottom]); // eslint-disable-line react-hooks/exhaustive-deps

  // Flex height / attachment decode can grow content after the first pin.
  useEffect(() => {
    if (preserveDeepLinkScroll || isLoading || !hasMessages) return;
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const pinIfStuck = () => {
      if (!stickToBottomRef.current || loadingMoreRef.current) return;
      scrollElementToBottom(el, 'instant');
    };

    const ro = new ResizeObserver(pinIfStuck);
    ro.observe(el);
    const inner = el.firstElementChild;
    if (inner) ro.observe(inner);

    // One extra frame after mount — parent flex often finalizes then.
    const raf = requestAnimationFrame(pinIfStuck);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [conversationId, isLoading, hasMessages, preserveDeepLinkScroll]);

  useEffect(() => {
    if (preserveDeepLinkScroll) return;
    if (isLoading) return;
    if (messages.length <= prevCountRef.current) {
      prevCountRef.current = messages.length;
      return;
    }
    const newest = messages[messages.length - 1];
    const ownNew = newest?.senderId === currentUserId;
    if (isAtBottom || ownNew) {
      scrollToBottom('smooth');
      setShowNewIndicator(false);
    } else {
      setShowNewIndicator(true);
    }
    prevCountRef.current = messages.length;
  }, [messages, isLoading, isAtBottom, scrollToBottom, currentUserId, preserveDeepLinkScroll]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !isFetchingMore) return;
    loadingMoreRef.current = true;
    stickToBottomRef.current = false;
    prevScrollHeightRef.current = el.scrollHeight;
  }, [isFetchingMore]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !loadingMoreRef.current) return;
    if (!isFetchingMore) {
      const diff = el.scrollHeight - prevScrollHeightRef.current;
      el.scrollTop += diff;
      loadingMoreRef.current = false;
      stickToBottomRef.current = isNearBottom(el);
      setIsAtBottom(stickToBottomRef.current);
    }
  }, [isFetchingMore, messages.length]);

  const syncPinnedIndex = useCallback(() => {
    const ids = pinnedIdsRef.current;
    const onChange = onPinnedIndexChangeRef.current;
    const el = containerRef.current;
    if (!ids?.length || !onChange || !el) return;

    const viewportTop = el.getBoundingClientRect().top + 4;
    const pinTopById: Record<string, number | null> = {};
    for (const id of ids) {
      const node = document.getElementById(`message-${id}`);
      pinTopById[id] = node ? node.getBoundingClientRect().top : null;
    }
    const next = resolvePinnedIndexForViewport(ids, pinTopById, viewportTop);
    if (lastEmittedPinIndexRef.current === next) return;
    lastEmittedPinIndexRef.current = next;
    onChange(next);
  }, []);

  const schedulePinnedSync = useCallback(() => {
    if (pinSyncRafRef.current) cancelAnimationFrame(pinSyncRafRef.current);
    pinSyncRafRef.current = requestAnimationFrame(() => {
      pinSyncRafRef.current = 0;
      syncPinnedIndex();
    });
  }, [syncPinnedIndex]);

  useEffect(() => {
    lastEmittedPinIndexRef.current = null;
    schedulePinnedSync();
  }, [pinnedIdsNewestFirst, messages.length, schedulePinnedSync]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !onPinnedScrollResume) return;
    const resume = () => onPinnedScrollResume();
    el.addEventListener('wheel', resume, { passive: true });
    el.addEventListener('touchstart', resume, { passive: true });
    el.addEventListener('pointerdown', resume);
    return () => {
      el.removeEventListener('wheel', resume);
      el.removeEventListener('touchstart', resume);
      el.removeEventListener('pointerdown', resume);
    };
  }, [onPinnedScrollResume, isLoading]);

  useEffect(() => {
    return () => {
      if (pinSyncRafRef.current) cancelAnimationFrame(pinSyncRafRef.current);
    };
  }, []);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = isNearBottom(el, CHAT_NEAR_BOTTOM_PX);
    stickToBottomRef.current = atBottom;
    setIsAtBottom(atBottom);
    if (atBottom) setShowNewIndicator(false);

    if (el.scrollTop < 80 && hasMore && !isFetchingMore) {
      onLoadMore?.();
    }
    schedulePinnedSync();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      onDragDrop?.(e.dataTransfer.files);
    }
  };

  if (isError) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <ErrorState message="Не удалось загрузить сообщения" onRetry={onRetry} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className={cnSkeleton(i)} />
        ))}
      </div>
    );
  }

  const visibleMessages = messages.filter((m) => !m.deletedAt);
  const messageMap = new Map(visibleMessages.map((m) => [m.id, m]));
  const entries = buildMessageListWithSeparators(visibleMessages, currentUserId, formatChatDateSeparator);

  if (visibleMessages.length === 0 && !isLoading) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="Начните общение"
        description="Напишите первое сообщение"
        className="flex-1"
      />
    );
  }

  return (
    <div
      className="relative flex flex-1 flex-col overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragOver && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-brand/10 backdrop-blur-sm">
          <p className="rounded-xl border-2 border-dashed border-brand px-6 py-4 text-body-sm text-brand">
            Перетащите файл сюда
          </p>
        </div>
      )}

      {isFetchingMore && (
        <div className="absolute left-0 right-0 top-0 z-10 flex justify-center py-2">
          <Skeleton className="h-6 w-24" />
        </div>
      )}

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="scrollbar-none min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[color-mix(in_srgb,var(--color-surface)_90%,var(--color-brand)_10%)] px-2 py-3 md:px-3"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col overflow-hidden">
          {entries.map((entry) =>
            entry.type === 'separator' ? (
              <div key={entry.key} className="my-3 flex justify-center py-1">
                <span className="glass-card rounded-full px-3 py-1 text-caption text-text-muted">
                  {entry.label}
                </span>
              </div>
            ) : entry.group.message.messageType === 'system' ? (
              <div key={entry.key} className="mt-3 first:mt-0">
                <SystemMessage message={entry.group.message} />
              </div>
            ) : (
              <div
                key={entry.key}
                className={entry.group.clusterStart ? 'mt-2.5 first:mt-0' : 'mt-0.5'}
              >
                <MessageBubble
                  message={entry.group.message}
                  sender={users.find((u) => u.id === entry.group.message.senderId)}
                  isOwn={entry.group.message.senderId === currentUserId}
                  showSender={entry.group.showSender}
                  showAvatar={entry.group.showAvatar}
                  isGroup={isGroup}
                  user={user}
                  conversation={conversation}
                  members={members}
                  replyToMessage={
                    entry.group.message.replyToMessageId
                      ? messageMap.get(entry.group.message.replyToMessageId)
                      : undefined
                  }
                  replyToSender={
                    entry.group.message.replyToMessageId
                      ? users.find(
                          (u) =>
                            u.id === messageMap.get(entry.group.message.replyToMessageId!)?.senderId,
                        )
                      : undefined
                  }
                  onReply={onReply}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onReport={onReport}
                  onForward={onForward}
                  onReact={onReact}
                  onPin={onPin}
                  onReplyClick={(id) => scrollToMessage(id)}
                  onImageClick={onImageClick}
                  highlighted={highlightMessageId === entry.group.message.id}
                  highlightVariant={highlightVariant}
                />
                {entry.group.message.status === 'failed' && onRetryMessage && (
                  <div className="mt-1 flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => onRetryMessage(entry.group.message)}>
                      Повторить
                    </Button>
                  </div>
                )}
              </div>
            ),
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {!isAtBottom && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-3">
          <div className="pointer-events-auto relative">
            <IconButton
              label={
                showNewIndicator
                  ? 'Новые сообщения — вниз'
                  : 'Вниз к последним сообщениям'
              }
              variant="secondary"
              size="md"
              onClick={() => {
                scrollToBottom();
                setShowNewIndicator(false);
                setIsAtBottom(true);
              }}
              className={cn(
                'rounded-full border border-border bg-surface-elevated text-text-primary shadow-lg',
                'hover:bg-surface-hover',
              )}
            >
              <ChevronDown className="h-5 w-5" aria-hidden />
            </IconButton>
            {showNewIndicator && (
              <span
                className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-surface"
                aria-hidden
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
});

function cnSkeleton(i: number): string {
  return i % 2 === 0 ? 'ml-auto h-12 w-2/3 max-w-xs' : 'h-12 w-2/3 max-w-xs';
}
