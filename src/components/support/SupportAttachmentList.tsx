import { useState } from 'react';
import { FileText } from 'lucide-react';
import { detectAttachmentType } from '@/services/chat/validation';
import type { MessageAttachment, SupportTicketAttachment } from '@/types';
import { Card } from '@/components/ui/Card';
import { AudioPlayer } from '@/components/ui/AudioPlayer';
import { ImageViewer } from '@/components/chat/ImageViewer';
import { downloadFromUrl } from '@/utils/files';

interface SupportAttachmentListProps {
  attachments: SupportTicketAttachment[];
}

function toMessageAttachment(attachment: SupportTicketAttachment): MessageAttachment {
  return {
    id: attachment.id,
    type: 'image',
    url: attachment.url,
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    size: 0,
  };
}

export function SupportAttachmentList({ attachments }: SupportAttachmentListProps) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  if (attachments.length === 0) return null;

  const images = attachments
    .filter((a) => detectAttachmentType(a.mimeType, a.filename) === 'image')
    .map(toMessageAttachment);

  return (
    <>
      <ul className="mt-4 space-y-2" aria-label="Вложения">
        {attachments.map((attachment) => {
          const type = detectAttachmentType(attachment.mimeType, attachment.filename);

          return (
            <li key={attachment.id}>
              {type === 'image' ? (
                <button
                  type="button"
                  className="block max-w-full overflow-hidden rounded-lg border border-border-subtle focus-ring"
                  aria-label={`Открыть ${attachment.filename}`}
                  onClick={() => {
                    const idx = images.findIndex((img) => img.id === attachment.id);
                    setViewerIndex(idx >= 0 ? idx : 0);
                  }}
                >
                  <img
                    src={attachment.url}
                    alt={attachment.filename}
                    className="max-h-64 w-full object-contain"
                  />
                </button>
              ) : type === 'audio' ? (
                <AudioPlayer
                  src={attachment.url}
                  title={attachment.filename}
                  downloadUrl={attachment.url}
                  downloadFilename={attachment.filename}
                />
              ) : type === 'video' ? (
                <Card padding="sm">
                  <video controls src={attachment.url} className="max-h-64 w-full rounded-lg">
                    <track kind="captions" />
                  </video>
                </Card>
              ) : (
                <button
                  type="button"
                  className="w-full text-left focus-ring"
                  onClick={() => {
                    void downloadFromUrl(attachment.url, attachment.filename);
                  }}
                >
                  <Card padding="sm" className="flex items-center gap-2 hover:border-brand/30">
                    <FileText className="h-4 w-4 text-brand" aria-hidden />
                    <span className="text-sm">{attachment.filename}</span>
                  </Card>
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <ImageViewer
        images={images}
        initialIndex={viewerIndex ?? 0}
        open={viewerIndex != null}
        onClose={() => setViewerIndex(null)}
      />
    </>
  );
}
