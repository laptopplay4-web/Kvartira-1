import { cn } from '@/utils';
import { formatChatListTime } from '@/utils/dates';
import type { Conversation, User } from '@/types';
import { getConversationDisplayTitle, isGroupLike, truncatePreview } from '@/services/chat/helpers';
import { Avatar } from '@/components/ui/Avatar';
import { BellOff, Users } from 'lucide-react';

interface ConversationItemProps {
  conversation: Conversation;
  currentUserId: string;
  users: User[];
  isActive?: boolean;
  muted?: boolean;
  onClick: () => void;
}

export function ConversationItem({
  conversation,
  currentUserId,
  users,
  isActive,
  muted,
  onClick,
}: ConversationItemProps) {
  const title = getConversationDisplayTitle(conversation, currentUserId, users);
  const isGroup = isGroupLike(conversation);
  const otherId = conversation.participantIds.find((id) => id !== currentUserId);
  const other = users.find((u) => u.id === otherId);
  const preview = conversation.lastMessage?.text
    ? truncatePreview(conversation.lastMessage.text)
    : 'Нет сообщений';
  const time = conversation.lastMessageAt ? formatChatListTime(conversation.lastMessageAt) : '';
  const unread = conversation.unreadCount ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors focus-ring min-h-[72px]',
        isActive ? 'bg-brand-muted/60' : 'hover:bg-surface-elevated',
      )}
      aria-current={isActive ? 'true' : undefined}
    >
      {isGroup ? (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-muted text-accent">
          <Users className="h-5 w-5" aria-hidden />
        </div>
      ) : other ? (
        <Avatar firstName={other.firstName} lastName={other.lastName} size="md" />
      ) : (
        <div className="h-11 w-11 shrink-0 rounded-full bg-surface-elevated" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={cn('truncate font-medium', unread > 0 && 'text-text-primary')}>{title}</p>
          {muted && <BellOff className="h-3.5 w-3.5 shrink-0 text-text-muted" aria-label="Без звука" />}
          {time && (
            <span className="ml-auto shrink-0 text-caption tabular-nums text-text-muted">{time}</span>
          )}
        </div>
        <p className={cn('truncate text-body-sm', unread > 0 ? 'text-text-primary' : 'text-text-muted')}>
          {preview}
        </p>
      </div>

      {unread > 0 && (
        <span
          className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-bold text-brand-contrast"
          aria-label={`${unread} непрочитанных`}
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}
