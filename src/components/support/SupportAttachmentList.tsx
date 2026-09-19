import { useState } from 'react';
import { FileText } from 'lucide-react';
import { detectAttachmentType } from '@/services/chat/validation';
import type { MessageAttachment, SupportTicketAttachment } from '@/types';
import { Card } from '@/components/ui/Card';
import { AudioPlayer } from '@/components/ui/AudioPlayer';
import { VideoPlayer } from '@/components/ui/VideoPlayer';
import { MediaImageGrid } from '@/components/ui/MediaImageGrid';
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
  const others = attachments.filter(
    (a) => detectAttachmentType(a.mimeType, a.filename) !== 'image',
  );

  return (
    <>
      <div className="mt-4 space-y-3" aria-label="Вложения">
        {images.length > 0 && (
          <div className="overflow-hidden rounded-xl">
            <MediaImageGrid
              images={images.map((a) => ({ id: a.id, url: a.url, alt: a.filename }))}
              size="page"
              onImageClick={(_, i) => setViewerIndex(i)}
            />
          </div>
        )}
        <ul className="space-y-2">
          {others.map((attachment) => {
            const type = detectAttachmentType(attachment.mimeType, attachment.filename);

            return (
              <li key={attachment.id}>
                {type === 'audio' ? (
                  <AudioPlayer
                    src={attachment.url}
                    title={attachment.filename}
                    downloadUrl={attachment.url}
                    downloadFilename={attachment.filename}
                    bare
                  />
                ) : type === 'video' ? (
                  <div className="overflow-hidden rounded-xl">
                    <VideoPlayer
                      src={attachment.url}
                      mimeType={attachment.mimeType}
                      className="aspect-video w-full max-h-[min(70vh,32rem)]"
                      aria-label={attachment.filename}
                    />
                  </div>
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
      </div>
      <ImageViewer
        images={images}
        initialIndex={viewerIndex ?? 0}
        open={viewerIndex != null}
        onClose={() => setViewerIndex(null)}
      />
    </>
  );
}