import type { Conversation, User } from '@/types';
import type { ChatFilter } from '@/services/chat/helpers';
import { filterConversations } from '@/services/chat/helpers';
import { ConversationItem } from './ConversationItem';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { MessageCircle } from 'lucide-react';

interface ConversationListProps {
  conversations: Conversation[];
  currentUserId: string;
  users: User[];
  activeId?: string;
  search: string;
  filter: ChatFilter;
  isLoading?: boolean;
  onSelect: (id: string) => void;
  emptyAction?: React.ReactNode;
}

export function ConversationList({
  conversations,
  currentUserId,
  users,
  activeId,
  search,
  filter,
  isLoading,
  onSelect,
  emptyAction,
}: ConversationListProps) {
  const filtered = filterConversations(conversations, {
    search,
    filter,
    currentUserId,
    users,
  });

  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[72px] rounded-xl" />
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <EmptyState
        icon={MessageCircle}
        title={search || filter !== 'all' ? 'Ничего не найдено' : 'Нет сообщений'}
        description={
          search || filter !== 'all'
            ? 'Попробуйте изменить поиск или фильтр'
            : 'Здесь появятся ваши личные и групповые чаты'
        }
        action={emptyAction}
        className="py-8"
      />
    );
  }

  return (
    <div className="flex flex-col gap-0.5 p-2" role="list" aria-label="Список чатов">
      {filtered.map((conv) => (
        <ConversationItem
          key={conv.id}
          conversation={conv}
          currentUserId={currentUserId}
          users={users}
          isActive={conv.id === activeId}
          onClick={() => onSelect(conv.id)}
        />
      ))}
    </div>
  );
}
