import { Pin, X } from 'lucide-react';
import type { Message, User } from '@/types';
import { formatUserName } from '@/utils';
import { getMessageDisplayText } from '@/services/chat/messages';
import { truncatePreview } from '@/services/chat/helpers';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/utils';

interface PinnedMessageBarProps {
  message: Message;
  sender?: User;
  /** Total pinned messages in this chat (Telegram-style). */
  pinnedCount: number;
  /** 1-based index in cycle (newest → oldest). */
  currentIndex: number;
  onClick: () => void;
  onUnpin?: () => void;
}

export function PinnedMessageBar({
  message,
  sender,
  pinnedCount,
  currentIndex,
  onClick,
  onUnpin,
}: PinnedMessageBarProps) {
  const title =
    pinnedCount <= 1
      ? 'Закреплённое сообщение'
      : `Закреплённые сообщения · ${currentIndex}/${pinnedCount}`;

  return (
    <div className="flex w-full items-center gap-1 border-b border-border-subtle bg-surface-elevated pl-3 pr-1 min-h-[44px]">
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-2.5 py-2 text-left focus-ring rounded-lg"
        aria-label={
          pinnedCount <= 1
            ? 'Перейти к закреплённому сообщению'
            : `Закреплённое ${currentIndex} из ${pinnedCount}. Нажмите, чтобы перейти к следующему`
        }
      >
        {/* Telegram-like stack of pin markers */}
        <div className="flex h-9 w-1.5 shrink-0 flex-col justify-center gap-0.5" aria-hidden>
          {Array.from({ length: Math.min(pinnedCount, 5) }, (_, i) => (
            <span
              key={i}
              className={cn(
                'w-full rounded-full',
                i === (currentIndex - 1) % Math.min(pinnedCount, 5)
                  ? 'h-2 bg-brand'
                  : 'h-1 bg-brand/35',
              )}
            />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-caption font-medium text-brand">{title}</p>
          <p className="truncate text-caption text-text-muted">
            {sender ? `${formatUserName(sender)}: ` : ''}
            {truncatePreview(getMessageDisplayText(message), 80)}
          </p>
        </div>
        <Pin className="h-4 w-4 shrink-0 text-brand/70" aria-hidden />
      </button>
      {onUnpin && (
        <IconButton
          label="Открепить сообщение"
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onUnpin();
          }}
        >
          <X className="h-4 w-4" aria-hidden />
        </IconButton>
      )}
    </div>
  );
}
