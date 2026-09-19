import { cn } from '@/utils';
import {
  displayAttachmentFilename,
  formatFileSize,
  isVoiceAttachment,
} from '@/services/chat/attachments';
import { downloadFromUrl } from '@/utils/files';
import type { MessageAttachment } from '@/types';
import { FileText } from 'lucide-react';
import { AudioPlayer, type AudioPlayerHandle } from '@/components/ui/AudioPlayer';
import { VoiceMessagePlayer } from '@/components/ui/VoiceMessagePlayer';
import { VideoPlayer } from '@/components/ui/VideoPlayer';
import { MediaImageGrid } from '@/components/ui/MediaImageGrid';
import { useChatVoicePlayback } from './ChatVoicePlayback';
import { useRef } from 'react';

interface AttachmentListProps {
  attachments: MessageAttachment[];
  isOwn?: boolean;
  onImageClick?: (attachment: MessageAttachment, index: number) => void;
  /** Flush media to bubble edges (chat). */
  flush?: boolean;
}

export function AttachmentList({
  attachments,
  isOwn,
  onImageClick,
  flush = true,
}: AttachmentListProps) {
  if (!attachments.length) return null;

  const images = attachments.filter((a) => a.type === 'image');
  const others = attachments.filter((a) => a.type !== 'image');

  return (
    <div className={cn('min-w-0 max-w-full', flush ? 'space-y-0.5' : 'mt-2 space-y-2')}>
      {images.length > 0 && (
        <MediaImageGrid
          images={images.map((a) => ({
            id: a.id,
            url: a.url,
            alt: displayAttachmentFilename(a.filename) || 'Фото',
          }))}
          size="chat"
          onImageClick={(_, i) => {
            const att = images[i];
            if (att) onImageClick?.(att, i);
          }}
        />
      )}
      {others.map((att) => (
        <AttachmentItem key={att.id} attachment={att} isOwn={isOwn} flush={flush} />
      ))}
    </div>
  );
}

function AttachmentItem({
  attachment,
  isOwn,
  flush,
}: {
  attachment: MessageAttachment;
  isOwn?: boolean;
  flush?: boolean;
}) {
  if (attachment.type === 'audio' && attachment.url) {
    if (isVoiceAttachment(attachment)) {
      return <ChatVoiceAttachment attachment={attachment} isOwn={isOwn} />;
    }
    return (
      <div className={cn(flush ? 'px-2 py-1.5' : undefined)}>
        <AudioPlayer
          src={attachment.url}
          mimeType={attachment.mimeType}
          title={displayAttachmentFilename(attachment.filename) || undefined}
          isOwn={isOwn}
          showVolume={false}
          showSpeed={false}
          bare
        />
      </div>
    );
  }

  if (attachment.type === 'video' && attachment.url) {
    return (
      <div className="relative min-w-0 max-w-full overflow-hidden">
        <VideoPlayer
          src={attachment.url}
          mimeType={attachment.mimeType}
          className="aspect-video w-full max-h-[min(55vh,26rem)]"
          aria-label="Видео"
        />
      </div>
    );
  }

  const label = displayAttachmentFilename(attachment.filename) || 'Файл';

  return (
    <button
      type="button"
      onClick={() => {
        if (!attachment.url) return;
        void downloadFromUrl(attachment.url, attachment.filename);
      }}
      className={cn(
        'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors focus-ring',
        flush ? 'hover:bg-black/10' : 'rounded-lg border hover:bg-surface',
        !flush && (isOwn ? 'border-brand-contrast/20' : 'border-border-subtle'),
      )}
    >
      <FileText className="h-5 w-5 shrink-0 opacity-70" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{label}</p>
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
    <VoiceMessagePlayer
      src={attachment.url}
      mimeType={attachment.mimeType}
      seed={attachment.id}
      isOwn={isOwn}
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
