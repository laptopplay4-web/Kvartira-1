import { FileText } from 'lucide-react';
import { detectAttachmentType } from '@/services/chat/validation';
import type { SupportTicketAttachment } from '@/types';
import { Card } from '@/components/ui/Card';
import { AudioPlayer } from '@/components/ui/AudioPlayer';

interface SupportAttachmentListProps {
  attachments: SupportTicketAttachment[];
}

export function SupportAttachmentList({ attachments }: SupportAttachmentListProps) {
  if (attachments.length === 0) return null;

  return (
    <ul className="mt-4 space-y-2" aria-label="Вложения">
      {attachments.map((attachment) => {
        const type = detectAttachmentType(attachment.mimeType, attachment.filename);

        return (
          <li key={attachment.id}>
            {type === 'image' ? (
              <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                <img
                  src={attachment.url}
                  alt={attachment.filename}
                  className="max-h-64 rounded-lg border border-border-subtle"
                />
              </a>
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
              <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                <Card padding="sm" className="flex items-center gap-2 hover:border-brand/30">
                  <FileText className="h-4 w-4 text-brand" aria-hidden />
                  <span className="text-sm">{attachment.filename}</span>
                </Card>
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
