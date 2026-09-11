import { X, FileIcon } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { formatFileSize } from '@/services/chat/attachments';
import type { PendingAttachment } from './MessageComposer';

interface AttachmentPreviewProps {
  attachments: PendingAttachment[];
  onRemove: (id: string) => void;
}

export function AttachmentPreview({ attachments, onRemove }: AttachmentPreviewProps) {
  if (!attachments.length) return null;

  return (
    <div className="flex flex-wrap gap-2 px-1 pb-2">
      {attachments.map((att) => (
        <div
          key={att.id}
          className="relative flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-elevated px-2 py-1.5"
        >
          {att.previewUrl ? (
            <img src={att.previewUrl} alt="" className="h-10 w-10 rounded object-cover" />
          ) : (
            <FileIcon className="h-5 w-5 text-text-muted" aria-hidden />
          )}
          <div className="min-w-0 max-w-[120px]">
            <p className="truncate text-caption">{att.filename}</p>
            <p className="text-[10px] text-text-muted">{formatFileSize(att.size)}</p>
          </div>
          {att.error && <span className="text-[10px] text-danger">{att.error}</span>}
          {att.uploading && <span className="text-[10px] text-text-muted">Загрузка…</span>}
          <IconButton
            label="Удалить вложение"
            size="sm"
            onClick={() => onRemove(att.id)}
            className="h-7 w-7 shrink-0"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </IconButton>
        </div>
      ))}
    </div>
  );
}
