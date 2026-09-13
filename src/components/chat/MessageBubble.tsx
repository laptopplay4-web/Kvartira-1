import { useRef, useState } from 'react';
import { cn, formatUserName } from '@/utils';
import { formatChatMessageTime } from '@/utils/dates';
import type { Conversation, ConversationMember, Message, User } from '@/types';
import { CheckCheck, AlertCircle, Loader2 } from 'lucide-react';
import { getRoleLabel, getRoleBadgeVariant } from '@/permissions';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { AttachmentList } from './AttachmentList';
import { MessageActions } from './MessageActions';
import { UserPreviewTrigger } from '@/components/users/UserPreviewTrigger';
import {
  getMessageDisplayText,
  getMessageReactions,
  resolveOwnReceiptStatus,
} from '@/services/chat/messages';
import { getReplyPreviewText } from '@/services/chat/helpers';

const LONG_PRESS_MS = 450;

interface MessageBubbleProps {
  message: Message;
  sender?: User;
  isOwn: boolean;
  showSender?: boolean;
  showAvatar?: boolean;
  isGroup?: boolean;
  user: User;
  conversation?: Conversation | null;
  members?: ConversationMember[];
  replyToMessage?: Message;
  replyToSender?: User;
  onReply?: (message: Message) => void;
  onEdit?: (message: Message) => void;
  onDelete?: (message: Message, scope: 'me' | 'everyone') => void;
  onReport?: (message: Message) => void;
  onForward?: (message: Message) => void;
  onReact?: (message: Message, emoji: string) => void;
  onPin?: (message: Message) => void;
  onReplyClick?: (messageId: string) => void;
  onImageClick?: (message: Message, index: number) => void;
  highlighted?: boolean;
  /** Report deep-link uses danger ring; default is brand. */
  highlightVariant?: 'brand' | 'report';
}

function StatusIcon({ status }: { status: Message['status'] }) {
  if (status === 'sending') return <Loader2 className="h-3.5 w-3.5 animate-spin opacity-70" aria-hidden />;
  if (status === 'failed') return <AlertCircle className="h-3.5 w-3.5 text-danger" aria-label="Не отправлено" />;
  if (status === 'read') {
    return <CheckCheck className="h-3.5 w-3.5 text-sky-300" aria-label="Прочитано" />;
  }
  return <CheckCheck className="h-3.5 w-3.5 opacity-60" aria-label="Доставлено" />;
}

export function MessageBubble({
  message,
  sender,
  isOwn,
  showSender = false,
  showAvatar = false,
  isGroup: _isGroup = false,
  user,
  conversation,
  members = [],
  replyToMessage,
  replyToSender,
  onReply,
  onEdit,
  onDelete,
  onReport,
  onForward,
  onReact,
  onPin,
  onReplyClick,
  onImageClick,
  highlighted,
  highlightVariant = 'brand',
}: MessageBubbleProps) {
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [pressing, setPressing] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressVisualTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchMoved = useRef(false);

  const time = formatChatMessageTime(message.createdAt);
  const displayText = getMessageDisplayText(message);
  const isDeleted = !!message.deletedAt;
  if (isDeleted) return null;

  const receiptStatus = isOwn
    ? resolveOwnReceiptStatus(message, members, conversation?.participantIds ?? [user.id])
    : message.status;
  const reactions = getMessageReactions(message);
  const hasText = !!displayText.trim();

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
    setActionsOpen(true);
  };

  const startLongPress = () => {
    touchMoved.current = false;
    clearLongPress();
    pressVisualTimer.current = setTimeout(() => setPressing(true), 60);
    longPressTimer.current = setTimeout(() => openActions(), LONG_PRESS_MS);
  };

  return (
    <div
      className={cn(
        'relative flex min-w-0 max-w-full gap-1.5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200',
        isOwn ? 'flex-row-reverse' : 'flex-row',
        actionsOpen && 'z-[1]',
        highlighted &&
          (highlightVariant === 'report'
            ? 'rounded-lg ring-2 ring-danger shadow-[0_0_0_1px_var(--color-danger)] motion-safe:animate-pulse'
            : 'rounded-lg ring-2 ring-brand/50 motion-safe:animate-pulse'),
      )}
      id={`message-${message.id}`}
    >
      {!isOwn && showAvatar && sender ? (
        <UserPreviewTrigger user={sender} className="mt-auto shrink-0 rounded-full p-0">
          <Avatar
            src={sender.avatarUrl}
            firstName={sender.firstName}
            lastName={sender.lastName}
            size="sm"
          />
        </UserPreviewTrigger>
      ) : !isOwn ? (
        <div className="w-8 shrink-0" aria-hidden />
      ) : null}

      <div
        ref={bubbleRef}
        className={cn(
          'relative flex w-full max-w-[min(78%,22rem)] min-w-0 flex-col gap-0.5',
          isOwn ? 'items-end' : 'items-start',
        )}
      >
        {!isOwn && showSender && (
          <span className="px-1">
            {sender?.role ? (
              <UserPreviewTrigger user={sender} className="inline-flex max-w-full rounded-md p-0">
                <Badge
                  variant={getRoleBadgeVariant(sender.role)}
                  className="max-w-full gap-1.5 border border-current/25 font-normal"
                >
                  <span className="truncate font-bold">{formatUserName(sender)}</span>
                  <span className="opacity-90">{getRoleLabel(sender.role)}</span>
                </Badge>
              </UserPreviewTrigger>
            ) : (
              <Badge
                variant="default"
                className="max-w-full border border-border font-bold"
              >
                {sender ? formatUserName(sender) : 'Удалённый аккаунт'}
              </Badge>
            )}
          </span>
        )}
        <div
          role="button"
          tabIndex={0}
          aria-expanded={actionsOpen}
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
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openActions();
            }
          }}
          className={cn(
            'relative w-full max-w-full overflow-hidden px-3 py-2 text-body-sm shadow-sm cursor-pointer',
            isOwn
              ? 'rounded-2xl rounded-br-md bg-brand text-brand-contrast'
              : 'rounded-2xl rounded-bl-md bg-surface-elevated text-text-primary',
            // Accent selection — contrasts with both brand (own) and surface (other) bubbles
            actionsOpen && 'ring-2 ring-accent shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_28%,transparent)]',
            message.status === 'failed' && !actionsOpen && 'ring-1 ring-danger/40',
            !hasText && message.attachments?.length ? 'px-1.5 pt-1.5 pb-1' : '',
          )}
          aria-label={`Сообщение от ${sender ? formatUserName(sender) : 'вас'}, ${time}`}
        >
          {/* Press feedback on overlay — accent, not brand (avoids matching bubble fill) */}
          {pressing && !actionsOpen && (
            <span
              aria-hidden
              className={cn(
                'pointer-events-none absolute inset-0 bg-accent/35 motion-safe:animate-chat-long-press',
                isOwn ? 'rounded-2xl rounded-br-md' : 'rounded-2xl rounded-bl-md',
              )}
            />
          )}

          <div className="relative z-[1]">
            {message.replyToMessageId && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (message.replyToMessageId) onReplyClick?.(message.replyToMessageId);
                }}
                className={cn(
                  'mb-1.5 w-full rounded-lg border-l-2 px-2 py-1 text-left text-caption',
                  isOwn ? 'border-brand-contrast/50 bg-black/10' : 'border-brand bg-surface',
                )}
              >
                <span className="font-medium">
                  {replyToSender ? formatUserName(replyToSender) : 'Ответ'}
                </span>
                <p className="truncate opacity-80">{getReplyPreviewText(replyToMessage)}</p>
              </button>
            )}

            {hasText && (
              <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{displayText}</p>
            )}

            {message.attachments && message.attachments.length > 0 && (
              <AttachmentList
                attachments={message.attachments}
                isOwn={isOwn}
                onImageClick={(_, i) => onImageClick?.(message, i)}
              />
            )}

            <div
              className={cn(
                'mt-0.5 flex items-center justify-end gap-1 text-[10px] tabular-nums',
                isOwn ? 'text-brand-contrast/75' : 'text-text-muted',
              )}
            >
              {message.editedAt && <span className="opacity-70">изм.</span>}
              <span>{time}</span>
              {isOwn && <StatusIcon status={receiptStatus} />}
            </div>
          </div>
        </div>

        {reactions.length > 0 && (
          <div
            className={cn(
              'flex flex-wrap gap-1 px-1',
              isOwn ? 'justify-end' : 'justify-start',
            )}
          >
            {reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface px-1.5 py-0.5 text-caption shadow-sm focus-ring',
                  r.userIds.includes(user.id) && 'border-brand/40 bg-brand-muted',
                )}
                onClick={() => onReact?.(message, r.emoji)}
                aria-label={`Реакция ${r.emoji}, ${r.userIds.length}`}
              >
                <span>{r.emoji}</span>
                {r.userIds.length > 1 && <span className="text-text-muted">{r.userIds.length}</span>}
              </button>
            ))}
          </div>
        )}

        <MessageActions
          message={message}
          user={user}
          isOwn={isOwn}
          open={actionsOpen}
          onClose={() => setActionsOpen(false)}
          onReply={() => onReply?.(message)}
          onEdit={() => onEdit?.(message)}
          onDelete={(scope) => onDelete?.(message, scope)}
          onReport={onReport ? () => onReport(message) : undefined}
          onForward={onForward ? () => onForward(message) : undefined}
          onReact={onReact ? (emoji) => onReact(message, emoji) : undefined}
          onPin={onPin ? () => onPin(message) : undefined}
          conversation={conversation}
          members={members}
          anchorRef={bubbleRef}
          preferSheet
        />
      </div>
    </div>
  );
}
