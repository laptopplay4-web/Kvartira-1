import { useCallback, useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import type { Message, User } from '@/types';
import { buildMessageListWithSeparators } from '@/services/chat/helpers';
import { formatChatDateSeparator } from '@/utils/dates';
import { MessageBubble } from './MessageBubble';
import { SystemMessage } from './SystemMessage';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Button } from '@/components/ui/Button';
import { MessageCircle, ChevronDown } from 'lucide-react';

export interface MessageListHandle {
  scrollToMessage: (messageId: string) => void;
  scrollToBottom: () => void;
}

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  user: User;
  users: User[];
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
  onDelete?: (message: Message) => void;
  onImageClick?: (message: Message, index: number) => void;
  onDragDrop?: (files: FileList) => void;
  highlightMessageId?: string | null;
}

export const MessageList = forwardRef<MessageListHandle, MessageListProps>(function MessageList(
  {
    messages,
    currentUserId,
    user,
    users,
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
    onImageClick,
    onDragDrop,
    highlightMessageId,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showNewIndicator, setShowNewIndicator] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const prevCountRef = useRef(messages.length);
  const prevScrollHeightRef = useRef(0);
  const loadingMoreRef = useRef(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
  }, []);

  const scrollToMessage = useCallback(
    (messageId: string) => {
      const el = document.getElementById(`message-${messageId}`);
      if (el) {
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

  useEffect(() => {
    if (isLoading) return;
    if (messages.length > prevCountRef.current && isAtBottom) {
      scrollToBottom();
    } else if (messages.length > prevCountRef.current && !isAtBottom) {
      setShowNewIndicator(true);
    }
    prevCountRef.current = messages.length;
  }, [messages.length, isLoading, isAtBottom, scrollToBottom]);

  useEffect(() => {
    if (!isLoading && messages.length > 0 && !loadingMoreRef.current) {
      scrollToBottom('instant');
    }
  }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !isFetchingMore) return;
    loadingMoreRef.current = true;
    prevScrollHeightRef.current = el.scrollHeight;
  }, [isFetchingMore]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !loadingMoreRef.current) return;
    if (!isFetchingMore) {
      const diff = el.scrollHeight - prevScrollHeightRef.current;
      el.scrollTop += diff;
      loadingMoreRef.current = false;
    }
  }, [isFetchingMore, messages.length]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setIsAtBottom(atBottom);
    if (atBottom) setShowNewIndicator(false);

    if (el.scrollTop < 80 && hasMore && !isFetchingMore) {
      onLoadMore?.();
    }
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

  if (messages.length === 0) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="Начните общение"
        description="Напишите первое сообщение"
        className="flex-1"
      />
    );
  }

  const messageMap = new Map(messages.map((m) => [m.id, m]));
  const entries = buildMessageListWithSeparators(messages, currentUserId, formatChatDateSeparator);

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
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 md:px-4"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-3 overflow-hidden">
          {entries.map((entry) =>
            entry.type === 'separator' ? (
              <div key={entry.key} className="flex justify-center py-2">
                <span className="rounded-full bg-surface-elevated px-3 py-1 text-caption text-text-muted">
                  {entry.label}
                </span>
              </div>
            ) : entry.group.message.messageType === 'system' ? (
              <SystemMessage key={entry.key} message={entry.group.message} />
            ) : (
              <div key={entry.key}>
                <MessageBubble
                  message={entry.group.message}
                  sender={users.find((u) => u.id === entry.group.message.senderId)}
                  isOwn={entry.group.message.senderId === currentUserId}
                  showSender={entry.group.showSender}
                  showAvatar={entry.group.showAvatar}
                  isGroup={isGroup}
                  user={user}
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
                  onReplyClick={(id) => scrollToMessage(id)}
                  onImageClick={onImageClick}
                  highlighted={highlightMessageId === entry.group.message.id}
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

      {showNewIndicator && (
        <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              scrollToBottom();
              setShowNewIndicator(false);
            }}
            className="shadow-lg"
          >
            <ChevronDown className="h-4 w-4" />
            Новые сообщения
          </Button>
        </div>
      )}
    </div>
  );
});

function cnSkeleton(i: number): string {
  return i % 2 === 0 ? 'ml-auto h-12 w-2/3 max-w-xs' : 'h-12 w-2/3 max-w-xs';
}
