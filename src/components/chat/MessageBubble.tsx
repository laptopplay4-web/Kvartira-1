import { useRef, useState } from 'react';
import { cn, formatUserName } from '@/utils';
import { formatChatMessageTime } from '@/utils/dates';
import type { Message, User } from '@/types';
import { Check, CheckCheck, AlertCircle, Loader2 } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { AttachmentList } from './AttachmentList';
import { MessageActions } from './MessageActions';
import { getMessageDisplayText, countReaders } from '@/services/chat/messages';
import { getReplyPreviewText } from '@/services/chat/helpers';

interface MessageBubbleProps {
  message: Message;
  sender?: User;
  isOwn: boolean;
  showSender?: boolean;
  showAvatar?: boolean;
  isGroup?: boolean;
  user: User;
  replyToMessage?: Message;
  replyToSender?: User;
  onReply?: (message: Message) => void;
  onEdit?: (message: Message) => void;
  onDelete?: (message: Message) => void;
  onReplyClick?: (messageId: string) => void;
  onImageClick?: (message: Message, index: number) => void;
  highlighted?: boolean;
}

function StatusIcon({ status }: { status: Message['status'] }) {
  if (status === 'sending') return <Loader2 className="h-3 w-3 animate-spin opacity-70" aria-hidden />;
  if (status === 'failed') return <AlertCircle className="h-3 w-3 text-danger" aria-label="Не отправлено" />;
  if (status === 'read') return <CheckCheck className="h-3 w-3 opacity-70" aria-label="Прочитано" />;
  return <Check className="h-3 w-3 opacity-70" aria-label="Отправлено" />;
}

export function MessageBubble({
  message,
  sender,
  isOwn,
  showSender = false,
  showAvatar = false,
  isGroup = false,
  user,
  replyToMessage,
  replyToSender,
  onReply,
  onEdit,
  onDelete,
  onReplyClick,
  onImageClick,
  highlighted,
}: MessageBubbleProps) {
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const time = formatChatMessageTime(message.createdAt);
  const displayText = getMessageDisplayText(message);
  const isDeleted = !!message.deletedAt;
  const readCount = isGroup ? countReaders(message, message.senderId) : 0;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setActionsOpen(true);
  };

  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => setActionsOpen(true), 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  return (
    <div
      className={cn(
        'relative flex min-w-0 max-w-full gap-2 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200',
        isOwn ? 'flex-row-reverse' : 'flex-row',
        highlighted && 'rounded-lg ring-2 ring-brand/50 motion-safe:animate-pulse',
      )}
      id={`message-${message.id}`}
    >
      {!isOwn && showAvatar && sender ? (
        <Avatar firstName={sender.firstName} lastName={sender.lastName} size="sm" className="mt-1 shrink-0" />
      ) : !isOwn ? (
        <div className="w-8 shrink-0" aria-hidden />
      ) : null}

      <div ref={bubbleRef} className={cn('relative flex w-full max-w-[min(85%,28rem)] min-w-0 flex-col gap-1', isOwn ? 'items-end' : 'items-start')}>
        {!isOwn && showSender && sender && (
          <span className="px-1 text-caption text-text-muted">{formatUserName(sender)}</span>
        )}
        <div
          role="button"
          tabIndex={0}
          onContextMenu={handleContextMenu}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setActionsOpen(true);
            }
          }}
          className={cn(
            'w-full max-w-full overflow-hidden rounded-2xl px-4 py-2.5 text-body-sm shadow-sm cursor-pointer',
            isOwn
              ? 'rounded-br-md bg-brand text-brand-contrast'
              : 'rounded-bl-md bg-surface-elevated text-text-primary',
            message.status === 'failed' && 'ring-1 ring-danger/40',
            isDeleted && 'italic opacity-70',
          )}
          aria-label={`Сообщение от ${sender ? formatUserName(sender) : 'вас'}, ${time}`}
        >
          {message.replyToMessageId && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (message.replyToMessageId) onReplyClick?.(message.replyToMessageId);
              }}
              className={cn(
                'mb-2 w-full rounded-lg border-l-2 px-2 py-1 text-left text-caption',
                isOwn ? 'border-brand-contrast/50 bg-black/10' : 'border-brand bg-surface',
              )}
            >
              <span className="font-medium">{replyToSender ? formatUserName(replyToSender) : 'Ответ'}</span>
              <p className="truncate opacity-80">{getReplyPreviewText(replyToMessage)}</p>
            </button>
          )}

          {!isDeleted && <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{displayText}</p>}
          {isDeleted && <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{displayText}</p>}

          {!isDeleted && message.attachments && message.attachments.length > 0 && (
            <AttachmentList
              attachments={message.attachments}
              isOwn={isOwn}
              onImageClick={(_, i) => onImageClick?.(message, i)}
            />
          )}

          <div
            className={cn(
              'mt-1 flex items-center justify-end gap-1 text-[10px] tabular-nums',
              isOwn ? 'text-brand-contrast/70' : 'text-text-muted',
            )}
          >
            {message.editedAt && <span className="opacity-70">изм.</span>}
            <span>{time}</span>
            {isOwn && <StatusIcon status={message.status} />}
            {isGroup && readCount > 0 && (
              <span className="opacity-70" aria-label={`Прочитано: ${readCount}`}>
                · {readCount}
              </span>
            )}
          </div>
        </div>

        <MessageActions
          message={message}
          user={user}
          isOwn={isOwn}
          open={actionsOpen}
          onClose={() => setActionsOpen(false)}
          onReply={() => onReply?.(message)}
          onEdit={() => onEdit?.(message)}
          onDelete={() => onDelete?.(message)}
          anchorRef={bubbleRef}
        />
      </div>
    </div>
  );
}
