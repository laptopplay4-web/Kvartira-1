import { X, FileIcon } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import {
  displayAttachmentFilename,
  formatFileSize,
  isVoiceAttachment,
} from '@/services/chat/attachments';
import { detectAttachmentType } from '@/services/chat/validation';
import type { PendingAttachment } from './MessageComposer';

interface AttachmentPreviewProps {
  attachments: PendingAttachment[];
  onRemove: (id: string) => void;
}

function previewLabel(att: PendingAttachment): string | null {
  if (att.previewUrl) return null;
  const type = detectAttachmentType(att.mimeType, att.filename);
  if (type === 'image') return 'Фото';
  if (type === 'video') return 'Видео';
  if (type === 'audio' && isVoiceAttachment({
    id: att.id,
    type: 'audio',
    filename: att.filename,
    mimeType: att.mimeType,
    size: att.size,
    kind: att.attachment?.kind,
  })) {
    return 'Голосовое';
  }
  return displayAttachmentFilename(att.filename) || att.filename;
}

export function AttachmentPreview({ attachments, onRemove }: AttachmentPreviewProps) {
  if (!attachments.length) return null;

  return (
    <div className="flex flex-wrap gap-2 px-1 pb-2">
      {attachments.map((att) => {
        const label = previewLabel(att);
        return (
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
              {label ? <p className="truncate text-caption">{label}</p> : null}
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
        );
      })}
    </div>
  );
}
