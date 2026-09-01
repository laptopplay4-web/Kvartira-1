import type { Message } from '@/types';

interface SystemMessageProps {
  message: Message;
}

export function SystemMessage({ message }: SystemMessageProps) {
  return (
    <div className="flex justify-center py-2">
      <span className="rounded-full bg-surface-elevated px-4 py-1.5 text-center text-caption text-text-muted">
        {message.text}
      </span>
    </div>
  );
}
