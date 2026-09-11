import { cn } from '@/utils';
import { formatFileSize } from '@/services/chat/attachments';
import { downloadFromUrl } from '@/utils/files';
import type { MessageAttachment } from '@/types';
import { FileText, Film, Image as ImageIcon } from 'lucide-react';
import { AudioPlayer } from '@/components/ui/AudioPlayer';

interface AttachmentListProps {
  attachments: MessageAttachment[];
  isOwn?: boolean;
  onImageClick?: (attachment: MessageAttachment, index: number) => void;
}

export function AttachmentList({ attachments, isOwn, onImageClick }: AttachmentListProps) {
  if (!attachments.length) return null;

  const images = attachments.filter((a) => a.type === 'image');
  const others = attachments.filter((a) => a.type !== 'image');

  return (
    <div className="mt-2 min-w-0 max-w-full space-y-2">
      {images.length > 0 && (
        <div className={cn('grid max-w-full gap-1', images.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
          {images.map((att, i) => (
            <button
              key={att.id}
              type="button"
              onClick={() => onImageClick?.(att, i)}
              className="overflow-hidden rounded-lg focus-ring"
              aria-label={`Открыть ${att.filename}`}
            >
              {att.url ? (
                <img src={att.url} alt={att.filename} className="max-h-48 max-w-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="flex h-24 items-center justify-center bg-surface">
                  <ImageIcon className="h-8 w-8 text-text-muted" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
      {others.map((att) => (
        <AttachmentItem key={att.id} attachment={att} isOwn={isOwn} />
      ))}
    </div>
  );
}

function AttachmentItem({ attachment, isOwn }: { attachment: MessageAttachment; isOwn?: boolean }) {
  if (attachment.type === 'audio' && attachment.url) {
    return (
      <AudioPlayer
        src={attachment.url}
        title={attachment.filename}
        downloadUrl={attachment.url}
        downloadFilename={attachment.filename}
        variant="compact"
        isOwn={isOwn}
      />
    );
  }

  const Icon = attachment.type === 'video' ? Film : FileText;

  return (
    <button
      type="button"
      onClick={() => {
        if (!attachment.url) return;
        void downloadFromUrl(attachment.url, attachment.filename);
      }}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-surface focus-ring',
        isOwn ? 'border-brand-contrast/20' : 'border-border-subtle',
      )}
    >
      <Icon className="h-5 w-5 shrink-0 opacity-70" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{attachment.filename}</p>
        <p className="text-caption opacity-70">{formatFileSize(attachment.size)}</p>
      </div>
    </button>
  );
}
