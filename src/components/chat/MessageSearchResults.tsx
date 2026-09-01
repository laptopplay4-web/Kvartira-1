import type { MessageSearchResult } from '@/types';
import { formatChatListTime } from '@/utils/dates';
import { truncatePreview } from '@/services/chat/helpers';

interface MessageSearchResultsProps {
  results: MessageSearchResult[];
  isLoading?: boolean;
  onSelect: (conversationId: string, messageId: string) => void;
}

export function MessageSearchResults({ results, isLoading, onSelect }: MessageSearchResultsProps) {
  if (isLoading) {
    return <p className="px-4 py-2 text-caption text-text-muted">Поиск…</p>;
  }

  if (results.length === 0) return null;

  return (
    <div className="border-b border-border-subtle">
      <p className="px-4 py-2 text-caption font-medium text-text-muted">Сообщения</p>
      <ul>
        {results.map((r) => (
          <li key={r.message.id}>
            <button
              type="button"
              onClick={() => onSelect(r.conversationId, r.message.id)}
              className="flex w-full flex-col gap-0.5 px-4 py-3 text-left hover:bg-surface-elevated focus-ring min-h-[44px]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{r.conversationTitle}</span>
                <span className="shrink-0 text-caption text-text-muted">
                  {formatChatListTime(r.message.createdAt)}
                </span>
              </div>
              <span className="text-caption text-text-muted">{r.senderName}</span>
              <span className="truncate text-body-sm">{truncatePreview(r.message.text)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
