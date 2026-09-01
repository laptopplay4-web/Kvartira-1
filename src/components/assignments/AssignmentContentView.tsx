import type { AssignmentContentBlock, AssignmentContentType } from '@/types';
import { AudioPlayer } from '@/components/ui/AudioPlayer';
import { Card } from '@/components/ui/Card';
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

export function AssignmentContentView({ blocks }: AssignmentContentViewProps) {
  const sorted = [...blocks].sort((a, b) => a.order - b.order);

  if (sorted.length === 0) return null;

  return (
    <section className="mb-4 space-y-3" aria-labelledby="content-blocks-heading">
      <h2 id="content-blocks-heading" className="text-label uppercase tracking-wide">
        Материалы
      </h2>
      {sorted.map((block) => (
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
                downloadUrl={block.url}
                downloadFilename={block.filename}
              />
            </div>
          )}
          {block.type === 'pdf' && block.url && (
            <a
              href={block.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm text-brand hover:underline"
            >
              {block.filename ?? 'Открыть PDF'}
            </a>
          )}
          {block.type === 'video' && block.url && (
            <video controls src={block.url} className="mt-2 max-h-80 w-full rounded-lg">
              <track kind="captions" />
            </video>
          )}
        </Card>
      ))}
    </section>
  );
}
