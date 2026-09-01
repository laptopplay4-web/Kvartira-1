import { cn } from '@/utils';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { canCreateGroupChat, canCreatePersonalChat } from '@/services/chat/access';
import { isGroupLike } from '@/services/chat/helpers';
import type { ChatFilter } from '@/services/chat/helpers';
import type { Message } from '@/types';
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
import { Button } from '@/components/ui/Button';
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
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);
  const [imageViewer, setImageViewer] = useState<{ images: Message['attachments']; index: number } | null>(null);

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
    queryFn: () => api.users.getAllUsers(),
  });

  const { data: searchResults, isLoading: searchLoading } = useSearchMessages(user.id, search);

  const sendMutation = useSendMessage();
  const editMutation = useEditMessage();
  const deleteMutation = useDeleteMessage();
  const messages = flattenMessages(messagePages?.pages);
  const { typingText } = useTypingIndicator(activeId, user.id, users ?? []);

  const pinnedId = activeConversation?.pinnedMessageIds?.[0];
  const pinnedMessage = pinnedId ? messages.find((m) => m.id === pinnedId) : undefined;

  const canCreate = canCreatePersonalChat(user) || canCreateGroupChat(user);

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
    const images = message.attachments?.filter((a) => a.type === 'image') ?? [];
    if (images.length > 0) setImageViewer({ images, index });
  };

  const convForbidden = convError instanceof ApiError && convError.status === 403;
  const convNotFound = convError instanceof ApiError && convError.status === 404;

  const listPanel = (
    <div className="flex h-full min-w-0 flex-col overflow-hidden border-border-subtle md:border-r">
      <div className="shrink-0 space-y-3 overflow-hidden border-b border-border-subtle p-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-h2">Чат</h1>
          {canCreate && (
            <Button size="icon" variant="secondary" onClick={() => setCreateOpen(true)} aria-label="Новый чат">
              <Plus className="h-5 w-5" />
            </Button>
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
            currentUserId={user.id}
            users={users ?? []}
            activeId={activeId}
            search={search}
            filter={filter}
            isLoading={listLoading}
            onSelect={handleSelect}
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

          {pinnedMessage && (
            <PinnedMessageBar
              message={pinnedMessage}
              sender={users?.find((u) => u.id === pinnedMessage.senderId)}
              onClick={() => messageListRef.current?.scrollToMessage(pinnedMessage.id)}
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
                onImageClick={handleImageClick}
                highlightMessageId={highlightMessageId}
              />
              <TypingIndicator text={typingText} />
              <MessageComposer
                conversationId={activeId}
                userId={user.id}
                draft={draft}
                onDraftChange={setDraft}
                onClearDraft={clearDraft}
                onSend={handleSend}
                isSending={sendMutation.isPending || editMutation.isPending}
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
        onCreated={(conversationId) => navigate(`/chat/${conversationId}`)}
      />

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
