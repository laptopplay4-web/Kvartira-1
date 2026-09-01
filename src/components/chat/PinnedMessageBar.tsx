import { Pin } from 'lucide-react';
import type { Message, User } from '@/types';
import { formatUserName } from '@/utils';
import { getMessageDisplayText } from '@/services/chat/messages';
import { truncatePreview } from '@/services/chat/helpers';

interface PinnedMessageBarProps {
  message: Message;
  sender?: User;
  onClick: () => void;
}

export function PinnedMessageBar({ message, sender, onClick }: PinnedMessageBarProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 border-b border-border-subtle bg-surface-elevated px-4 py-2 text-left focus-ring min-h-[44px]"
      aria-label="Перейти к закреплённому сообщению"
    >
      <Pin className="h-4 w-4 shrink-0 text-brand" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-caption font-medium text-brand">
          {sender ? formatUserName(sender) : 'Закреплено'}
        </p>
        <p className="truncate text-caption text-text-muted">
          {truncatePreview(getMessageDisplayText(message), 80)}
        </p>
      </div>
    </button>
  );
}
