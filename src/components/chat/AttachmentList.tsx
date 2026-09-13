import { cn } from '@/utils';
import { formatFileSize, isVoiceAttachment } from '@/services/chat/attachments';
import { downloadFromUrl } from '@/utils/files';
import type { MessageAttachment } from '@/types';
import { Download, FileText } from 'lucide-react';
import { AudioPlayer, type AudioPlayerHandle } from '@/components/ui/AudioPlayer';
import { useChatVoicePlayback } from './ChatVoicePlayback';
import { useRef } from 'react';

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
              aria-label="Открыть фото"
            >
              {att.url ? (
                <img src={att.url} alt="" className="max-h-48 max-w-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="flex h-24 items-center justify-center bg-surface">
                  <span className="text-caption text-text-muted">Фото</span>
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
    if (isVoiceAttachment(attachment)) {
      return <ChatVoiceAttachment attachment={attachment} isOwn={isOwn} />;
    }
    return (
      <AudioPlayer
        src={attachment.url}
        title={attachment.filename}
        downloadUrl={attachment.url}
        downloadFilename={attachment.filename}
        variant="compact"
        isOwn={isOwn}
        showVolume={false}
        showSpeed={false}
      />
    );
  }

  if (attachment.type === 'video' && attachment.url) {
    return (
      <div className="relative min-w-0 max-w-full overflow-hidden rounded-lg">
        <video
          src={attachment.url}
          controls
          playsInline
          preload="metadata"
          className="max-h-64 w-full rounded-lg bg-black object-contain"
          aria-label="Видео"
        >
          <track kind="captions" />
        </video>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void downloadFromUrl(attachment.url!, attachment.filename || 'video.mp4').catch(() => {
              /* keep in-app */
            });
          }}
          className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75 focus-ring"
          aria-label="Скачать видео"
        >
          <Download className="h-4 w-4" aria-hidden />
        </button>
      </div>
    );
  }

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
      <FileText className="h-5 w-5 shrink-0 opacity-70" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{attachment.filename}</p>
        <p className="text-caption opacity-70">{formatFileSize(attachment.size)}</p>
      </div>
    </button>
  );
}

function ChatVoiceAttachment({
  attachment,
  isOwn,
}: {
  attachment: MessageAttachment;
  isOwn?: boolean;
}) {
  const ctx = useChatVoicePlayback();
  const handleRef = useRef<AudioPlayerHandle | null>(null);

  if (!attachment.url) return null;

  return (
    <AudioPlayer
      src={attachment.url}
      variant="compact"
      isOwn={isOwn}
      showVolume={false}
      showSpeed={false}
      playbackRate={ctx?.speed}
      playerRef={(handle) => {
        handleRef.current = handle;
        ctx?.registerHandle(attachment.id, handle);
      }}
      onPlayRequest={() => {
        if (ctx && handleRef.current) ctx.claimPlay(attachment.id, handleRef.current);
      }}
      onPlayingChange={(playing) => {
        if (!playing) ctx?.notifyStopped(attachment.id);
      }}
    />
  );
}
