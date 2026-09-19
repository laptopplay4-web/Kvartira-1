import { useMemo, useState, type ReactNode } from 'react';
import type { AssignmentContentBlock, AssignmentContentType, MessageAttachment } from '@/types';
import { Download } from 'lucide-react';
import { AudioPlayer } from '@/components/ui/AudioPlayer';
import { Card } from '@/components/ui/Card';
import { VideoPlayer } from '@/components/ui/VideoPlayer';
import { IconButton } from '@/components/ui/IconButton';
import { ImageViewer } from '@/components/chat/ImageViewer';
import { ASSIGNMENT_CONTENT_LABELS } from '@/services/assignments/constants';
import { displayAttachmentFilename } from '@/services/chat/attachments';
import { downloadFromUrl } from '@/utils/files';

interface AssignmentContentViewProps {
  blocks: AssignmentContentBlock[];
}

function BlockLabel({ type }: { type: AssignmentContentType }) {
  return (
    <span className="text-caption font-medium uppercase tracking-wide text-text-muted">
      {ASSIGNMENT_CONTENT_LABELS[type]}
    </span>
  );
}

function isImageBlock(block: AssignmentContentBlock): boolean {
  return (
    block.type === 'image' ||
    !!block.mimeType?.startsWith('image/') ||
    /\.(jpe?g|png|gif|webp)$/i.test(block.filename ?? '')
  );
}

function isDisplayableMediaUrl(url: string | undefined): boolean {
  return !!url && !url.startsWith('pbfile:');
}

function toImageAttachment(block: AssignmentContentBlock): MessageAttachment | null {
  if (!isImageBlock(block) || !isDisplayableMediaUrl(block.url)) return null;
  return {
    id: block.id,
    type: 'image',
    filename: block.filename ?? 'photo.jpg',
    mimeType: block.mimeType ?? 'image/jpeg',
    size: 0,
    url: block.url,
  };
}

/** Download control sits above media (top-right), not overlaid on the player. */
function MediaDownloadHeader({
  url,
  filename,
  label,
}: {
  url: string;
  filename?: string;
  label: string;
}) {
  return (
    <div className="mb-1 flex items-center justify-end">
      <IconButton
        label={label}
        size="sm"
        className="h-9 w-9 text-text-secondary hover:text-brand"
        onClick={() => {
          void downloadFromUrl(url, filename || 'download').catch(() => {
            /* keep in-app */
          });
        }}
      >
        <Download className="h-4 w-4" aria-hidden />
      </IconButton>
    </div>
  );
}

function MediaWithDownload({
  url,
  filename,
  downloadLabel,
  children,
}: {
  url: string;
  filename?: string;
  downloadLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-2 min-w-0">
      <MediaDownloadHeader url={url} filename={filename} label={downloadLabel} />
      {children}
    </div>
  );
}

export function AssignmentContentView({ blocks }: AssignmentContentViewProps) {
  const sorted = [...blocks].sort((a, b) => a.order - b.order);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const imageAttachments = useMemo(
    () =>
      sorted
        .map(toImageAttachment)
        .filter((a): a is MessageAttachment => a !== null),
    [sorted],
  );

  if (sorted.length === 0) return null;

  const nonImageBlocks = sorted.filter((b) => !isImageBlock(b) || !isDisplayableMediaUrl(b.url));
  const unresolvedImageBlocks = sorted.filter(
    (b) => isImageBlock(b) && !isDisplayableMediaUrl(b.url) && b.filename,
  );

  return (
    <section className="mb-4 space-y-3" aria-labelledby="content-blocks-heading">
      <h2 id="content-blocks-heading" className="text-label uppercase tracking-wide">
        Материалы
      </h2>

      {imageAttachments.length > 0 && (
        <div className="min-w-0 space-y-3">
          <BlockLabel type="image" />
          {imageAttachments.map((a, i) => (
            <MediaWithDownload
              key={a.id}
              url={a.url!}
              filename={a.filename}
              downloadLabel="Скачать фото"
            >
              <button
                type="button"
                onClick={() => setViewerIndex(i)}
                className="block w-full overflow-hidden rounded-xl focus-ring"
                aria-label={displayAttachmentFilename(a.filename) || 'Открыть фото'}
              >
                <img
                  src={a.url}
                  alt={displayAttachmentFilename(a.filename) || 'Фото'}
                  className="max-h-[min(70vh,32rem)] w-full object-cover"
                  loading="lazy"
                />
              </button>
            </MediaWithDownload>
          ))}
        </div>
      )}

      {unresolvedImageBlocks.map((block) => (
        <p key={block.id} className="text-body-sm text-text-secondary">
          {displayAttachmentFilename(block.filename) || block.filename}
        </p>
      ))}

      {nonImageBlocks.map((block) => {
        if (isImageBlock(block)) return null;
        return (
          <div key={block.id} className="min-w-0">
            <BlockLabel type={block.type} />
            {block.type === 'text' && block.text && (
              <Card className="mt-2">
                <p className="whitespace-pre-wrap text-body-sm">{block.text}</p>
              </Card>
            )}
            {block.type === 'voice' && block.url && isDisplayableMediaUrl(block.url) && (
              <MediaWithDownload
                url={block.url}
                filename={block.filename}
                downloadLabel="Скачать аудио"
              >
                <AudioPlayer
                  src={block.url}
                  title={displayAttachmentFilename(block.filename) || 'Голосовое'}
                  showVolume={false}
                  showSpeed={false}
                  bare
                />
              </MediaWithDownload>
            )}
            {block.type === 'voice' && block.url && !isDisplayableMediaUrl(block.url) && (
              <p className="mt-2 text-body-sm text-text-secondary">
                {displayAttachmentFilename(block.filename) || block.filename || 'Аудио'}
              </p>
            )}
            {block.type === 'pdf' && isDisplayableMediaUrl(block.url) && block.url && (
              <MediaWithDownload
                url={block.url}
                filename={block.filename}
                downloadLabel="Скачать PDF"
              >
                <a
                  href={block.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-sm text-brand hover:underline"
                >
                  {displayAttachmentFilename(block.filename) || 'Открыть PDF'}
                </a>
              </MediaWithDownload>
            )}
            {block.type === 'pdf' && !isDisplayableMediaUrl(block.url) && block.filename && (
              <p className="mt-2 text-body-sm text-text-secondary">
                {displayAttachmentFilename(block.filename) || block.filename}
              </p>
            )}
            {block.type === 'video' && isDisplayableMediaUrl(block.url) && block.url && (
              <MediaWithDownload
                url={block.url}
                filename={block.filename}
                downloadLabel="Скачать видео"
              >
                <div className="overflow-hidden rounded-xl">
                  <VideoPlayer
                    src={block.url}
                    mimeType={block.mimeType}
                    className="aspect-video w-full max-h-[min(70vh,32rem)]"
                    aria-label={displayAttachmentFilename(block.filename) || 'Видео'}
                  />
                </div>
              </MediaWithDownload>
            )}
          </div>
        );
      })}

      <ImageViewer
        images={imageAttachments}
        initialIndex={viewerIndex ?? 0}
        open={viewerIndex !== null}
        onClose={() => setViewerIndex(null)}
        showDownload={false}
      />
    </section>
  );
}
