import { X, Reply } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { Message, User } from '@/types';
import { formatUserName } from '@/utils';
import { getReplyPreviewText } from '@/services/chat/helpers';

interface ReplyPreviewProps {
  message: Message;
  sender?: User;
  onCancel: () => void;
}

export function ReplyPreview({ message, sender, onCancel }: ReplyPreviewProps) {
  return (
    <div className="flex items-stretch gap-2 rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2">
      <Reply className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-caption font-medium text-brand">
          {sender ? formatUserName(sender) : 'Ответ'}
        </p>
        <p className="truncate text-caption text-text-muted">{getReplyPreviewText(message)}</p>
      </div>
      <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Отменить ответ" className="shrink-0">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface ComposerReplyPreviewProps {
  replyTo: Message | null;
  users: User[];
  onCancel: () => void;
}

export function ComposerReplyPreview({ replyTo, users, onCancel }: ComposerReplyPreviewProps) {
  if (!replyTo) return null;
  const sender = users.find((u) => u.id === replyTo.senderId);
  return <ReplyPreview message={replyTo} sender={sender} onCancel={onCancel} />;
}
