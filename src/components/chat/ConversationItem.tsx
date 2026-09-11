import { useRef, useState } from 'react';
import { cn } from '@/utils';
import { formatChatListTime } from '@/utils/dates';
import type { Conversation, User } from '@/types';
import { getConversationDisplayTitle, isGroupLike, truncatePreview } from '@/services/chat/helpers';
import { isDisplayableAvatarSrc } from '@/services/profile/constants';
import { Avatar } from '@/components/ui/Avatar';
import { BellOff, Pin, Users } from 'lucide-react';
import { UserPreviewTrigger } from '@/components/users/UserPreviewTrigger';
import { ConversationActions } from './ConversationActions';

const LONG_PRESS_MS = 450;

interface ConversationItemProps {
  conversation: Conversation;
  currentUser: User;
  users: User[];
  isActive?: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPin: (pinned: boolean) => void;
  onMute: (muted: boolean) => void;
}

export function ConversationItem({
  conversation,
  currentUser,
  users,
  isActive,
  onClick,
  onEdit,
  onDelete,
  onPin,
  onMute,
}: ConversationItemProps) {
  const currentUserId = currentUser.id;
  const title = getConversationDisplayTitle(conversation, currentUserId, users);
  const isGroup = isGroupLike(conversation);
  const otherId = conversation.participantIds.find((id) => id !== currentUserId);
  const other = users.find((u) => u.id === otherId);
  const preview = conversation.lastMessage?.text
    ? truncatePreview(conversation.lastMessage.text)
    : 'Нет сообщений';
  const time = conversation.lastMessageAt ? formatChatListTime(conversation.lastMessageAt) : '';
  const unread = conversation.unreadCount ?? 0;
  const muted = !!conversation.viewerMuted;

  const rowRef = useRef<HTMLDivElement>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [pressing, setPressing] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressVisualTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchMoved = useRef(false);
  const suppressClick = useRef(false);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (pressVisualTimer.current) {
      clearTimeout(pressVisualTimer.current);
      pressVisualTimer.current = null;
    }
  };

  const cancelPress = () => {
    clearLongPress();
    setPressing(false);
  };

  const openActions = () => {
    clearLongPress();
    setPressing(false);
    suppressClick.current = true;
    setActionsOpen(true);
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 400);
  };

  const startLongPress = () => {
    touchMoved.current = false;
    clearLongPress();
    pressVisualTimer.current = setTimeout(() => setPressing(true), 60);
    longPressTimer.current = setTimeout(() => openActions(), LONG_PRESS_MS);
  };

  return (
    <div
      ref={rowRef}
      className={cn('relative rounded-xl', actionsOpen && 'z-[1]')}
      role="listitem"
    >
      <button
        type="button"
        onClick={() => {
          if (suppressClick.current || actionsOpen) return;
          onClick();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          openActions();
        }}
        onTouchStart={startLongPress}
        onTouchMove={() => {
          if (touchMoved.current) return;
          touchMoved.current = true;
          cancelPress();
        }}
        onTouchEnd={() => {
          if (!actionsOpen) cancelPress();
          else clearLongPress();
        }}
        onTouchCancel={cancelPress}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          startLongPress();
        }}
        onMouseUp={() => {
          if (!actionsOpen) cancelPress();
          else clearLongPress();
        }}
        onMouseLeave={() => {
          if (!actionsOpen) cancelPress();
        }}
        className={cn(
          'relative flex w-full items-center gap-3 overflow-hidden rounded-xl px-3 py-3 text-left focus-ring min-h-[72px]',
          actionsOpen
            ? 'bg-brand-muted ring-2 ring-brand/45'
            : isActive
              ? 'bg-brand-muted/60'
              : 'bg-surface hover:bg-surface-elevated',
        )}
        aria-current={isActive ? 'true' : undefined}
        aria-expanded={actionsOpen}
      >
        {/* Press feedback on overlay — avoid transform on text (blur on Windows) */}
        {pressing && !actionsOpen && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-xl bg-brand/25 motion-safe:animate-chat-long-press"
          />
        )}

        <span className="relative z-[1] flex w-full items-center gap-3">
          {isGroup ? (
            conversation.avatarUrl && isDisplayableAvatarSrc(conversation.avatarUrl) ? (
              <img
                src={conversation.avatarUrl}
                alt=""
                className="h-11 w-11 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-muted text-accent">
                <Users className="h-5 w-5" aria-hidden />
              </div>
            )
          ) : other ? (
            <UserPreviewTrigger user={other} as="span" className="shrink-0 rounded-full p-0">
              <Avatar
                src={other.avatarUrl}
                firstName={other.firstName}
                lastName={other.lastName}
                size="md"
              />
            </UserPreviewTrigger>
          ) : (
            <div className="h-11 w-11 shrink-0 rounded-full bg-surface-elevated" />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className={cn('truncate font-medium', unread > 0 && 'text-text-primary')}>{title}</p>
              {muted && (
                <BellOff className="h-3.5 w-3.5 shrink-0 text-text-muted" aria-label="Без звука" />
              )}
              {conversation.viewerPinnedAt && (
                <Pin className="h-3.5 w-3.5 shrink-0 text-brand" aria-label="Закреплён" />
              )}
              {time && (
                <span className="ml-auto shrink-0 text-caption tabular-nums text-text-muted">{time}</span>
              )}
            </div>
            <p
              className={cn(
                'truncate text-body-sm',
                unread > 0 ? 'text-text-primary' : 'text-text-muted',
              )}
            >
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
        </span>
      </button>

      <ConversationActions
        conversation={conversation}
        user={currentUser}
        open={actionsOpen}
        onClose={() => setActionsOpen(false)}
        onEdit={onEdit}
        onDelete={onDelete}
        onPin={onPin}
        onMute={onMute}
        anchorRef={rowRef}
      />
    </div>
  );
}
