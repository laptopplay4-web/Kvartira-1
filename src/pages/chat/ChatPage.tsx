import { cn } from '@/utils';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { useCurrentUser } from '@/stores/authStore';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { useChatConversations, useChatConversation } from '@/hooks/useChatConversations';
import { flattenMessages, useChatMessages } from '@/hooks/useChatMessages';
import { createClientMutationId, useSendMessage } from '@/hooks/useSendMessage';
import { useEditMessage } from '@/hooks/useEditMessage';
import { useDeleteMessage } from '@/hooks/useDeleteMessage';
import { useChatDraft } from '@/hooks/useChatDraft';
import { useChatRealtime } from '@/hooks/useChatRealtime';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useSearchMessages } from '@/hooks/useSearchMessages';
import { useBackNavigation } from '@/hooks/useBackNavigation';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { canManageChats } from '@/services/chat/access';
import { canPinMessage } from '@/services/chat/messages';
import { getConversationDisplayTitle, isGroupLike, orderPinnedMessagesNewestFirst } from '@/services/chat/helpers';
import type { ChatFilter } from '@/services/chat/helpers';
import { useConversationMembers } from '@/hooks/useConversationMembers';
import { ForwardMessageModal } from '@/components/chat/ForwardMessageModal';
import type { Conversation, ConversationMember, Message, MessageAttachment } from '@/types';
import { ConversationList } from '@/components/chat/ConversationList';
import { ChatFilters, ChatSearch } from '@/components/chat/ChatFilters';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { MessageList, type MessageListHandle } from '@/components/chat/MessageList';
import { MessageComposer } from '@/components/chat/MessageComposer';
import { CreateChatModal } from '@/components/chat/CreateChatModal';
import { MessageSearchResults } from '@/components/chat/MessageSearchResults';
import { PinnedMessageBar } from '@/components/chat/PinnedMessageBar';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { ImageViewer } from '@/components/chat/ImageViewer';
import { ConversationSettings } from '@/components/chat/ConversationSettings';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { IconButton } from '@/components/ui/IconButton';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { MessageCircle } from 'lucide-react';

export default function ChatPage() {
  const { id: activeId } = useParams<{ id: string }>();
  const user = useCurrentUser()!;
  const navigate = useNavigate();
  const goBackToChatList = useBackNavigation('/chat');
  const queryClient = useQueryClient();
  const messageListRef = useRef<MessageListHandle>(null);
  const isOnline = useOnlineStatus();
  const wasOfflineRef = useRef(false);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ChatFilter>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [settingsConversation, setSettingsConversation] = useState<Conversation | null>(null);
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);
  const [imageViewer, setImageViewer] = useState<{ images: Message['attachments']; index: number } | null>(null);
  const [pinnedCycleIndex, setPinnedCycleIndex] = useState(0);
  const freezePinnedScrollSyncRef = useRef(false);

  const { draft, setDraft, clearDraft } = useChatDraft(activeId);

  useChatRealtime(user.id, activeId);

  const {
    data: conversations,
    isLoading: listLoading,
    error: listError,
    refetch: refetchList,
  } = useChatConversations(user.id);

  const {
    data: activeConversation,
    error: convError,
    isLoading: convLoading,
  } = useChatConversation(activeId, user.id);

  const {
    data: messagePages,
    isLoading: messagesLoading,
    isError: messagesError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchMessages,
  } = useChatMessages(activeId, user.id);

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.users.getAllUsers(user.id),
  });

  const { data: searchResults, isLoading: searchLoading } = useSearchMessages(user.id, search);

  const sendMutation = useSendMessage();
  const editMutation = useEditMessage();
  const deleteMutation = useDeleteMessage();
  const canCreate = canManageChats(user);

  const deleteConversationMutation = useMutation({
    mutationFn: (conversationId: string) => api.chat.deleteConversation(conversationId, user.id),
    onSuccess: (_void, conversationId) => {
      setPendingDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
      queryClient.invalidateQueries({ queryKey: ['chat-unread', user.id] });
      if (activeId === conversationId) {
        navigate('/chat');
      }
    },
  });

  const muteConversationMutation = useMutation({
    mutationFn: ({ conversationId, muted }: { conversationId: string; muted: boolean }) =>
      api.chat.muteConversation(conversationId, user.id, { muted, mutedUntil: null }),
    onMutate: async ({ conversationId, muted }) => {
      await queryClient.cancelQueries({ queryKey: ['conversations', user.id] });
      await queryClient.cancelQueries({ queryKey: ['members', conversationId, user.id] });
      const previous = queryClient.getQueryData<Conversation[]>(['conversations', user.id]);
      const previousMembers = queryClient.getQueryData<ConversationMember[]>([
        'members',
        conversationId,
        user.id,
      ]);
      queryClient.setQueryData<Conversation[]>(['conversations', user.id], (old) =>
        (old ?? []).map((c) => (c.id === conversationId ? { ...c, viewerMuted: muted } : c)),
      );
      queryClient.setQueryData<ConversationMember[]>(
        ['members', conversationId, user.id],
        (old) =>
          (old ?? []).map((m) =>
            m.userId === user.id ? { ...m, muted, mutedUntil: muted ? m.mutedUntil : null } : m,
          ),
      );
      return { previous, previousMembers, conversationId };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(['conversations', user.id], ctx.previous);
      }
      if (ctx?.previousMembers) {
        queryClient.setQueryData(
          ['members', vars.conversationId, user.id],
          ctx.previousMembers,
        );
      }
    },
    onSuccess: (member, { conversationId }) => {
      queryClient.setQueryData<Conversation[]>(['conversations', user.id], (old) =>
        (old ?? []).map((c) =>
          c.id === conversationId ? { ...c, viewerMuted: !!member.muted } : c,
        ),
      );
      queryClient.setQueryData<ConversationMember[]>(
        ['members', conversationId, user.id],
        (old) =>
          (old ?? []).map((m) => (m.userId === user.id ? { ...m, ...member } : m)),
      );
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
      queryClient.invalidateQueries({ queryKey: ['members', vars.conversationId, user.id] });
    },
  });

  const pinConversationMutation = useMutation({
    mutationFn: ({ conversationId, pinned }: { conversationId: string; pinned: boolean }) =>
      api.chat.pinConversation(conversationId, user.id, pinned),
    onMutate: async ({ conversationId, pinned }) => {
      await queryClient.cancelQueries({ queryKey: ['conversations', user.id] });
      const previous = queryClient.getQueryData<Conversation[]>(['conversations', user.id]);
      queryClient.setQueryData<Conversation[]>(['conversations', user.id], (old) =>
        (old ?? []).map((c) =>
          c.id === conversationId
            ? { ...c, viewerPinnedAt: pinned ? new Date().toISOString() : null }
            : c,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(['conversations', user.id], ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
    },
  });

  const pendingDeleteConversation = pendingDeleteId
    ? (conversations ?? []).find((c) => c.id === pendingDeleteId)
    : undefined;
  const pendingDeleteTitle = pendingDeleteConversation
    ? getConversationDisplayTitle(pendingDeleteConversation, user.id, users ?? [])
    : 'чат';
  const { data: members } = useConversationMembers(activeId, user.id);

  const messages = flattenMessages(messagePages?.pages);
  const { typingText } = useTypingIndicator(activeId, user.id, users ?? []);

  const pinnedIds = activeConversation?.pinnedMessageIds ?? [];
  const pinnedIdsKey = pinnedIds.join(',');

  const { data: pinnedLoaded = [] } = useQuery({
    queryKey: ['pinned-messages', activeId, user.id, pinnedIdsKey],
    queryFn: async () => {
      if (!activeId || pinnedIds.length === 0) return [] as Message[];
      const rows = await Promise.all(
        pinnedIds.map((id) =>
          api.chat.getMessage(activeId, id, user.id).catch(() => null),
        ),
      );
      return rows.filter((m): m is Message => !!m && !m.deletedAt);
    },
    enabled: !!activeId && pinnedIds.length > 0,
  });

  const orderedPinned = orderPinnedMessagesNewestFirst(pinnedIds, pinnedLoaded);

  useEffect(() => {
    setPinnedCycleIndex(0);
    freezePinnedScrollSyncRef.current = false;
  }, [activeId, pinnedIdsKey]);

  useEffect(() => {
    if (orderedPinned.length === 0) {
      setPinnedCycleIndex(0);
      return;
    }
    if (pinnedCycleIndex >= orderedPinned.length) {
      setPinnedCycleIndex(0);
    }
  }, [orderedPinned.length, pinnedCycleIndex]);

  const pinnedMessage =
    orderedPinned.length > 0
      ? orderedPinned[pinnedCycleIndex % orderedPinned.length]
      : undefined;

  useEffect(() => {
    if (!activeId) {
      api.chat.setOpenConversation(user.id, null);
      return;
    }
    api.chat.setOpenConversation(user.id, activeId);
    api.chat.markAsRead(activeId, user.id).then(() => {
      refetchList();
      queryClient.invalidateQueries({ queryKey: ['chat-unread', user.id] });
    });
    return () => {
      api.chat.setOpenConversation(user.id, null);
    };
  }, [activeId, user.id, refetchList, queryClient]);

  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
      return;
    }
    if (wasOfflineRef.current) {
      wasOfflineRef.current = false;
      refetchList();
      if (activeId) refetchMessages();
      queryClient.invalidateQueries({ queryKey: ['chat-unread', user.id] });
    }
  }, [isOnline, activeId, refetchList, refetchMessages, queryClient, user.id]);

  const handleSelect = (conversationId: string) => {
    setReplyTo(null);
    setEditingMessage(null);
    navigate(`/chat/${conversationId}`);
  };

  const handleBack = () => {
    setReplyTo(null);
    setEditingMessage(null);
    goBackToChatList();
  };

  const handleSend = useCallback(
    (payload: { text: string; replyToMessageId?: string; attachments?: Message['attachments'] }) => {
      if (!activeId) return;
      sendMutation.mutate({
        conversationId: activeId,
        userId: user.id,
        text: payload.text,
        clientMutationId: createClientMutationId(),
        replyToMessageId: payload.replyToMessageId,
        attachments: payload.attachments,
      });
      setReplyTo(null);
      clearDraft();
    },
    [activeId, user.id, sendMutation, clearDraft],
  );

  const handleSaveEdit = useCallback(
    (text: string) => {
      if (!activeId || !editingMessage) return;
      editMutation.mutate(
        { conversationId: activeId, messageId: editingMessage.id, userId: user.id, text },
        {
          onSuccess: () => {
            setEditingMessage(null);
            clearDraft();
          },
        },
      );
    },
    [activeId, editingMessage, user.id, editMutation, clearDraft],
  );

  const handleEdit = (message: Message) => {
    setEditingMessage(message);
    setReplyTo(null);
    setDraft(message.text);
  };

  const handleDelete = (message: Message) => {
    if (!activeId) return;
    deleteMutation.mutate({ conversationId: activeId, messageId: message.id, userId: user.id });
  };

  const handleReact = (message: Message, emoji: string) => {
    if (!activeId) return;
    void api.chat.setMessageReaction(activeId, message.id, user.id, emoji).then(() => {
      queryClient.invalidateQueries({ queryKey: ['messages', activeId, user.id] });
    });
  };

  const handlePinMessage = (message: Message) => {
    if (!activeId) return;
    const alreadyPinned = activeConversation?.pinnedMessageIds?.includes(message.id);
    const op = alreadyPinned
      ? api.chat.unpinMessage(activeId, message.id, user.id)
      : api.chat.pinMessage(activeId, message.id, user.id);
    void op.then(() => {
      queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
      queryClient.invalidateQueries({ queryKey: ['conversation', activeId, user.id] });
      queryClient.invalidateQueries({ queryKey: ['pinned-messages', activeId, user.id] });
    });
  };

  const handleUnpinMessage = (message: Message) => {
    if (!activeId) return;
    void api.chat.unpinMessage(activeId, message.id, user.id).then(() => {
      queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
      queryClient.invalidateQueries({ queryKey: ['conversation', activeId, user.id] });
      queryClient.invalidateQueries({ queryKey: ['pinned-messages', activeId, user.id] });
    });
  };

  const handlePinnedBarClick = () => {
    if (!pinnedMessage || orderedPinned.length === 0) return;
    freezePinnedScrollSyncRef.current = true;
    messageListRef.current?.scrollToMessage(pinnedMessage.id);
    if (orderedPinned.length > 1) {
      setPinnedCycleIndex((i) => (i + 1) % orderedPinned.length);
    }
  };

  const handlePinnedIndexFromScroll = useCallback((index: number) => {
    if (freezePinnedScrollSyncRef.current) return;
    setPinnedCycleIndex((prev) => (prev === index ? prev : index));
  }, []);

  const handlePinnedScrollResume = useCallback(() => {
    freezePinnedScrollSyncRef.current = false;
  }, []);

  const handleForward = (targetIds: string[]) => {
    if (!activeId || !forwardMessage) return;
    void api.chat
      .forwardMessage(activeId, forwardMessage.id, user.id, targetIds)
      .then(() => {
        setForwardMessage(null);
        queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
      });
  };

  const handleRetryMessage = (message: Message) => {
    if (!activeId) return;
    sendMutation.mutate({
      conversationId: activeId,
      userId: user.id,
      text: message.text,
      clientMutationId: message.clientMutationId ?? createClientMutationId(),
      replyToMessageId: message.replyToMessageId,
      attachments: message.attachments,
    });
  };

  const handleSearchSelect = (conversationId: string, messageId: string) => {
    navigate(`/chat/${conversationId}`);
    setHighlightMessageId(messageId);
    setTimeout(() => {
      messageListRef.current?.scrollToMessage(messageId);
      setTimeout(() => setHighlightMessageId(null), 2000);
    }, 500);
  };

  const handleImageClick = (message: Message, index: number) => {
    const allImages: MessageAttachment[] = [];
    let startIndex = 0;
    for (const m of messages) {
      const imgs = m.attachments?.filter((a) => a.type === 'image') ?? [];
      if (m.id === message.id) {
        startIndex = allImages.length + index;
      }
      allImages.push(...imgs);
    }
    if (allImages.length > 0) setImageViewer({ images: allImages, index: startIndex });
  };

  const convForbidden = convError instanceof ApiError && convError.status === 403;
  const convNotFound = convError instanceof ApiError && convError.status === 404;

  const listPanel = (
    <div className="flex h-full min-w-0 flex-col overflow-hidden border-border-subtle md:border-r">
      <div className="shrink-0 space-y-3 overflow-hidden border-b border-border-subtle p-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-h2">Чат</h1>
          {canCreate && (
            <IconButton
              label="Новый чат"
              variant="secondary"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-5 w-5" aria-hidden />
            </IconButton>
          )}
        </div>
        <ChatSearch value={search} onChange={setSearch} icon={Search} />
        <ChatFilters value={filter} onChange={setFilter} />
      </div>

      <MessageSearchResults
        results={searchResults ?? []}
        isLoading={searchLoading}
        onSelect={handleSearchSelect}
      />

      {listError ? (
        <ErrorState message="Не удалось загрузить чаты. Попробуйте ещё раз." onRetry={() => refetchList()} />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ConversationList
            conversations={conversations ?? []}
            currentUser={user}
            users={users ?? []}
            activeId={activeId}
            search={search}
            filter={filter}
            isLoading={listLoading}
            onSelect={handleSelect}
            onEdit={(conv) => setSettingsConversation(conv)}
            onDelete={(conv) => {
              if (deleteConversationMutation.isPending) return;
              setPendingDeleteId(conv.id);
            }}
            onPin={(conv, pinned) => {
              pinConversationMutation.mutate({ conversationId: conv.id, pinned });
            }}
            onMute={(conv, muted) => {
              muteConversationMutation.mutate({ conversationId: conv.id, muted });
            }}
            emptyAction={
              canCreate ? (
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Новый чат
                </Button>
              ) : undefined
            }
          />
        </div>
      )}
    </div>
  );

  const conversationPanel = (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      {activeId ? (
        <>
          <ChatHeader
            conversation={activeConversation}
            currentUserId={user.id}
            currentUser={user}
            users={users ?? []}
            showBack
            onBack={handleBack}
          />

          {pinnedMessage && orderedPinned.length > 0 && (
            <PinnedMessageBar
              message={pinnedMessage}
              sender={users?.find((u) => u.id === pinnedMessage.senderId)}
              pinnedCount={orderedPinned.length}
              currentIndex={(pinnedCycleIndex % orderedPinned.length) + 1}
              onClick={handlePinnedBarClick}
              onUnpin={
                activeId && members && canPinMessage(user, members, activeId)
                  ? () => handleUnpinMessage(pinnedMessage)
                  : undefined
              }
            />
          )}

          {convForbidden ? (
            <EmptyState
              title="Нет доступа"
              description="У вас нет доступа к этому чату"
              action={
                <Button variant="secondary" onClick={handleBack}>
                  Вернуться к чатам
                </Button>
              }
              className="flex-1"
            />
          ) : convNotFound ? (
            <EmptyState
              title="Чат не найден"
              description="Возможно, он был удалён"
              action={
                <Button variant="secondary" onClick={handleBack}>
                  Вернуться к чатам
                </Button>
              }
              className="flex-1"
            />
          ) : convLoading && !activeConversation ? (
            <MessageList
              ref={messageListRef}
              messages={[]}
              currentUserId={user.id}
              user={user}
              users={users ?? []}
              isLoading
            />
          ) : (
            <>
              <MessageList
                ref={messageListRef}
                messages={messages}
                currentUserId={user.id}
                user={user}
                users={users ?? []}
                isGroup={activeConversation ? isGroupLike(activeConversation) : false}
                isLoading={messagesLoading}
                isError={messagesError}
                hasMore={hasNextPage}
                isFetchingMore={isFetchingNextPage}
                onRetry={() => refetchMessages()}
                onLoadMore={() => fetchNextPage()}
                onRetryMessage={handleRetryMessage}
                onReply={setReplyTo}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onForward={setForwardMessage}
                onReact={handleReact}
                onPin={
                  activeId && members && canPinMessage(user, members, activeId)
                    ? handlePinMessage
                    : undefined
                }
                onImageClick={handleImageClick}
                conversation={activeConversation}
                members={members ?? []}
                highlightMessageId={highlightMessageId}
                pinnedIdsNewestFirst={orderedPinned.map((m) => m.id)}
                onPinnedIndexChange={handlePinnedIndexFromScroll}
                onPinnedScrollResume={handlePinnedScrollResume}
              />
              <TypingIndicator text={typingText} />
              <MessageComposer
                conversationId={activeId}
                userId={user.id}
                draft={draft}
                onDraftChange={setDraft}
                onClearDraft={clearDraft}
                onSend={handleSend}
                isSending={editMutation.isPending}
                replyTo={replyTo}
                users={users ?? []}
                onCancelReply={() => setReplyTo(null)}
                editingMessage={editingMessage}
                onCancelEdit={() => {
                  setEditingMessage(null);
                  clearDraft();
                }}
                onSaveEdit={handleSaveEdit}
              />
            </>
          )}
        </>
      ) : (
        <>
          <ChatHeader currentUserId={user.id} currentUser={user} users={users ?? []} />
          <EmptyState
            icon={MessageCircle}
            title="Выберите чат"
            description="Выберите диалог из списка или создайте новый"
            className="hidden flex-1 md:flex"
          />
        </>
      )}
    </div>
  );

  return (
    <>
      <div
        className={cn(
          'mx-auto flex w-full min-w-0 max-w-6xl flex-col overflow-hidden md:px-4 md:py-4',
          activeId
            ? 'h-[calc(100dvh-var(--mobile-header-height))] md:h-[calc(100dvh-2rem)]'
            : 'h-[calc(100dvh-var(--mobile-header-height)-var(--bottom-nav-height))] md:h-[calc(100dvh-2rem)]',
        )}
      >
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-none border-0 bg-surface md:rounded-2xl md:border md:border-border-subtle">
          <div
            className={cn(
              activeId
                ? 'hidden md:flex md:h-full md:w-80 md:shrink-0 md:flex-col md:overflow-hidden'
                : 'flex h-full w-full min-w-0 flex-col overflow-hidden md:w-80 md:shrink-0',
            )}
          >
            {listPanel}
          </div>
          <div
            className={cn(
              activeId
                ? 'flex h-full min-w-0 flex-1 flex-col overflow-hidden'
                : 'hidden md:flex md:h-full md:min-w-0 md:flex-1 md:flex-col md:overflow-hidden',
            )}
          >
            {conversationPanel}
          </div>
        </div>
      </div>

      <CreateChatModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        currentUser={user}
        users={users ?? []}
        onCreated={(conversationId) => {
          setCreateOpen(false);
          navigate(`/chat/${conversationId}`);
        }}
      />

      <ForwardMessageModal
        open={!!forwardMessage}
        onClose={() => setForwardMessage(null)}
        conversations={conversations ?? []}
        currentUserId={user.id}
        users={users ?? []}
        excludeConversationId={activeId}
        onForward={handleForward}
      />

      <ConfirmDialog
        open={!!pendingDeleteId}
        onClose={() => {
          if (deleteConversationMutation.isPending) return;
          setPendingDeleteId(null);
          deleteConversationMutation.reset();
        }}
        title="Удалить чат?"
        description={
          <>
            <p>«{pendingDeleteTitle}» будет удалён без возможности восстановления.</p>
            {deleteConversationMutation.error && (
              <p className="mt-2 text-caption text-danger" role="alert">
                {deleteConversationMutation.error instanceof ApiError
                  ? deleteConversationMutation.error.message
                  : 'Не удалось удалить чат'}
              </p>
            )}
          </>
        }
        confirmLabel="Удалить"
        tone="destructive"
        loading={deleteConversationMutation.isPending}
        disabled={!isOnline || !pendingDeleteId}
        onConfirm={() => {
          if (!pendingDeleteId || deleteConversationMutation.isPending) return;
          deleteConversationMutation.mutate(pendingDeleteId);
        }}
      />

      {settingsConversation && (
        <ConversationSettings
          open
          onClose={() => setSettingsConversation(null)}
          conversation={
            conversations?.find((c) => c.id === settingsConversation.id) ?? settingsConversation
          }
          currentUser={user}
          users={users ?? []}
          onLeft={() => {
            setSettingsConversation(null);
            if (activeId === settingsConversation.id) navigate('/chat');
          }}
          onDeleted={() => {
            setSettingsConversation(null);
            if (activeId === settingsConversation.id) navigate('/chat');
          }}
        />
      )}

      {imageViewer && (
        <ImageViewer
          images={imageViewer.images ?? []}
          initialIndex={imageViewer.index}
          open
          onClose={() => setImageViewer(null)}
        />
      )}
    </>
  );
}
