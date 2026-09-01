import { useRef } from 'react';
import { Plus, X } from 'lucide-react';
import type { AssignmentContentType } from '@/types';
import { Button } from '@/components/ui/Button';
import {
  ASSIGNMENT_CONTENT_ACCEPT,
  ASSIGNMENT_CONTENT_LABELS,
  MAX_CONTENT_BLOCKS_PER_ASSIGNMENT,
} from '@/services/assignments/constants';

export interface PendingContentBlock {
  id: string;
  type: AssignmentContentType;
  order: number;
  text?: string;
  url?: string;
  filename?: string;
  mimeType?: string;
  uploading?: boolean;
  error?: string;
}

const CONTENT_TYPES: AssignmentContentType[] = ['text', 'voice', 'pdf', 'video'];

interface AssignmentContentEditorProps {
  blocks: PendingContentBlock[];
  onAddBlock: (type: AssignmentContentType) => void;
  onRemoveBlock: (id: string) => void;
  onTextChange: (id: string, text: string) => void;
  onFileSelected: (id: string, file: File) => void;
  disabled?: boolean;
}

export function AssignmentContentEditor({
  blocks,
  onAddBlock,
  onRemoveBlock,
  onTextChange,
  onFileSelected,
  disabled,
}: AssignmentContentEditorProps) {
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const canAdd = blocks.length < MAX_CONTENT_BLOCKS_PER_ASSIGNMENT;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {CONTENT_TYPES.map((type) => (
          <Button
            key={type}
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled || !canAdd}
            onClick={() => onAddBlock(type)}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {ASSIGNMENT_CONTENT_LABELS[type]}
          </Button>
        ))}
      </div>

      {blocks.length === 0 && (
        <p className="text-body-sm text-text-muted">Добавьте блоки: текст, голосовое MP3, PDF или видео.</p>
      )}

      <ul className="space-y-3">
        {blocks.map((block) => (
          <li
            key={block.id}
            className="rounded-lg border border-border-subtle bg-surface p-3"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{ASSIGNMENT_CONTENT_LABELS[block.type]}</span>
              <button
                type="button"
                onClick={() => onRemoveBlock(block.id)}
                className="min-h-11 min-w-11 rounded p-2 text-text-muted hover:text-danger focus-ring"
                aria-label="Удалить блок"
                disabled={disabled || block.uploading}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {block.type === 'text' ? (
              <textarea
                value={block.text ?? ''}
                onChange={(e) => onTextChange(block.id, e.target.value)}
                rows={4}
                placeholder="Текст задания…"
                disabled={disabled}
                className="w-full rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2 text-body-sm focus-ring"
              />
            ) : (
              <div className="space-y-2">
                <input
                  ref={(el) => {
                    fileRefs.current[block.id] = el;
                  }}
                  type="file"
                  accept={ASSIGNMENT_CONTENT_ACCEPT[block.type]}
                  className="sr-only"
                  disabled={disabled || block.uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onFileSelected(block.id, file);
                    e.target.value = '';
                  }}
                />
                {block.filename ? (
                  <p className="text-sm text-text-secondary">{block.filename}</p>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={disabled || block.uploading}
                    onClick={() => fileRefs.current[block.id]?.click()}
                  >
                    {block.uploading ? 'Загрузка…' : 'Выбрать файл'}
                  </Button>
                )}
              </div>
            )}

            {block.error && (
              <p className="mt-1 text-caption text-danger" role="alert">
                {block.error}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
