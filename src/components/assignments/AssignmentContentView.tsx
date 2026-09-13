import { useMemo, useState } from 'react';
import type { AssignmentContentBlock, AssignmentContentType, MessageAttachment } from '@/types';
import { AudioPlayer } from '@/components/ui/AudioPlayer';
import { Card } from '@/components/ui/Card';
import { ImageViewer } from '@/components/chat/ImageViewer';
import { ASSIGNMENT_CONTENT_LABELS } from '@/services/assignments/constants';

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

  return (
    <section className="mb-4 space-y-3" aria-labelledby="content-blocks-heading">
      <h2 id="content-blocks-heading" className="text-label uppercase tracking-wide">
        Материалы
      </h2>
      {sorted.map((block) => {
        const showImage = isImageBlock(block) && isDisplayableMediaUrl(block.url);
        return (
          <Card key={block.id}>
            <BlockLabel type={block.type} />
            {block.type === 'text' && block.text && (
              <p className="mt-2 whitespace-pre-wrap text-body-sm">{block.text}</p>
            )}
            {block.type === 'voice' && block.url && (
              <div className="mt-2">
                <AudioPlayer
                  src={block.url}
                  title={block.filename ?? 'Голосовое'}
                  downloadUrl={isDisplayableMediaUrl(block.url) ? block.url : undefined}
                  downloadFilename={block.filename}
                  showVolume={false}
                  showSpeed={false}
                />
              </div>
            )}
            {showImage && (
              <button
                type="button"
                className="mt-2 block w-full overflow-hidden rounded-lg focus-ring"
                aria-label={`Открыть ${block.filename ?? 'фото'}`}
                onClick={() => {
                  const idx = imageAttachments.findIndex((a) => a.id === block.id);
                  setViewerIndex(idx >= 0 ? idx : 0);
                }}
              >
                <img
                  src={block.url}
                  alt={block.filename ?? 'Фото'}
                  className="max-h-80 w-full object-contain bg-surface-elevated"
                  loading="lazy"
                />
              </button>
            )}
            {isImageBlock(block) && !showImage && block.filename && (
              <p className="mt-2 text-body-sm text-text-secondary">{block.filename}</p>
            )}
            {block.type === 'pdf' && isDisplayableMediaUrl(block.url) && (
              <a
                href={block.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm text-brand hover:underline"
              >
                {block.filename ?? 'Открыть PDF'}
              </a>
            )}
            {block.type === 'pdf' && !isDisplayableMediaUrl(block.url) && block.filename && (
              <p className="mt-2 text-body-sm text-text-secondary">{block.filename}</p>
            )}
            {block.type === 'video' && isDisplayableMediaUrl(block.url) && (
              <video controls src={block.url} className="mt-2 max-h-80 w-full rounded-lg">
                <track kind="captions" />
              </video>
            )}
          </Card>
        );
      })}

      <ImageViewer
        images={imageAttachments}
        initialIndex={viewerIndex ?? 0}
        open={viewerIndex !== null}
        onClose={() => setViewerIndex(null)}
      />
    </section>
  );
}
