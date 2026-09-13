import { useRef, useState } from 'react';
import { FileText, Film, Image as ImageIcon, Music, Paperclip, Type, X } from 'lucide-react';
import type { AssignmentContentType } from '@/types';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { Sheet } from '@/components/ui/Sheet';
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
  /** Хранение (в т.ч. pbfile:); для превью фото/видео — previewUrl. */
  url?: string;
  /** Локальный data:/blob: для превью до/после upload (pbfile нельзя в <img>). */
  previewUrl?: string;
  filename?: string;
  mimeType?: string;
  uploading?: boolean;
  error?: string;
}

const CONTENT_TYPES: AssignmentContentType[] = ['text', 'image', 'voice', 'pdf', 'video'];

const TYPE_ICONS: Record<AssignmentContentType, typeof Type> = {
  text: Type,
  image: ImageIcon,
  voice: Music,
  pdf: FileText,
  video: Film,
};

interface AssignmentContentEditorProps {
  blocks: PendingContentBlock[];
  onAddTextBlock: () => void;
  onAddFileBlock: (type: Exclude<AssignmentContentType, 'text'>, file: File) => void;
  onRemoveBlock: (id: string) => void;
  onTextChange: (id: string, text: string) => void;
  onReplaceFile: (id: string, file: File) => void;
  disabled?: boolean;
}

function isMobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
}

export function AssignmentContentEditor({
  blocks,
  onAddTextBlock,
  onAddFileBlock,
  onRemoveBlock,
  onTextChange,
  onReplaceFile,
  disabled,
}: AssignmentContentEditorProps) {
  const paperclipRef = useRef<HTMLButtonElement>(null);
  const typeFileRefs = useRef<Partial<Record<Exclude<AssignmentContentType, 'text'>, HTMLInputElement | null>>>({});
  const replaceFileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const pendingFileTypeRef = useRef<Exclude<AssignmentContentType, 'text'> | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const canAdd = blocks.length < MAX_CONTENT_BLOCKS_PER_ASSIGNMENT;

  const closeMenus = () => {
    setMenuOpen(false);
    setSheetOpen(false);
  };

  const handlePickType = (type: AssignmentContentType) => {
    closeMenus();
    if (!canAdd || disabled) return;
    if (type === 'text') {
      onAddTextBlock();
      return;
    }
    pendingFileTypeRef.current = type;
    // Defer so Sheet/Dropdown unmount doesn't steal the click gesture on iOS.
    window.setTimeout(() => {
      typeFileRefs.current[type]?.click();
    }, 0);
  };

  const openAttachMenu = () => {
    if (disabled || !canAdd) return;
    if (isMobileViewport()) {
      setSheetOpen(true);
    } else {
      setMenuOpen(true);
    }
  };

  const menuItems = CONTENT_TYPES.map((type) => {
    const Icon = TYPE_ICONS[type];
    return {
      id: type,
      label: ASSIGNMENT_CONTENT_LABELS[type],
      icon: <Icon className="h-4 w-4" aria-hidden />,
      disabled: disabled || !canAdd,
      onSelect: () => handlePickType(type),
    };
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-body-sm text-text-muted">
          {blocks.length === 0
            ? 'Добавьте текст, фото, MP3, PDF или видео через скрепку.'
            : `Материалов: ${blocks.length}`}
        </p>
        <IconButton
          ref={paperclipRef}
          type="button"
          label="Добавить материал"
          variant="secondary"
          size="md"
          disabled={disabled || !canAdd}
          onClick={openAttachMenu}
          aria-haspopup="menu"
          aria-expanded={menuOpen || sheetOpen}
        >
          <Paperclip className="h-5 w-5" aria-hidden />
        </IconButton>
      </div>

      {CONTENT_TYPES.filter((t): t is Exclude<AssignmentContentType, 'text'> => t !== 'text').map(
        (type) => (
          <input
            key={type}
            ref={(el) => {
              typeFileRefs.current[type] = el;
            }}
            type="file"
            accept={ASSIGNMENT_CONTENT_ACCEPT[type]}
            className="sr-only"
            disabled={disabled}
            onChange={(e) => {
              const file = e.target.files?.[0];
              const expected = pendingFileTypeRef.current ?? type;
              pendingFileTypeRef.current = null;
              if (file) onAddFileBlock(expected, file);
              e.target.value = '';
            }}
          />
        ),
      )}

      <DropdownMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={menuItems}
        anchorRef={paperclipRef}
        align="end"
      />

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Добавить материал" size="sm">
        <div className="flex flex-col gap-1 p-2">
          {CONTENT_TYPES.map((type) => {
            const Icon = TYPE_ICONS[type];
            return (
              <button
                key={type}
                type="button"
                disabled={disabled || !canAdd}
                className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-body-sm hover:bg-surface-elevated focus-ring disabled:opacity-50"
                onClick={() => handlePickType(type)}
              >
                <Icon className="h-5 w-5 text-brand" aria-hidden />
                {ASSIGNMENT_CONTENT_LABELS[type]}
              </button>
            );
          })}
        </div>
      </Sheet>

      <ul className="space-y-3">
        {blocks.map((block) => (
          <li key={block.id} className="rounded-lg border border-border-subtle bg-surface p-3">
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
                    replaceFileRefs.current[block.id] = el;
                  }}
                  type="file"
                  accept={ASSIGNMENT_CONTENT_ACCEPT[block.type]}
                  className="sr-only"
                  disabled={disabled || block.uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onReplaceFile(block.id, file);
                    e.target.value = '';
                  }}
                />
                {(block.type === 'image' || block.type === 'video') &&
                  (block.previewUrl ||
                    (block.url && !block.url.startsWith('pbfile:'))) && (
                  <div className="overflow-hidden rounded-lg bg-surface-elevated">
                    {block.type === 'image' ? (
                      <img
                        src={block.previewUrl || block.url}
                        alt={block.filename ?? 'Фото'}
                        className="max-h-48 w-full object-contain"
                      />
                    ) : (
                      <video
                        controls
                        src={block.previewUrl || block.url}
                        className="max-h-48 w-full"
                      >
                        <track kind="captions" />
                      </video>
                    )}
                  </div>
                )}
                {block.filename ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm text-text-secondary">
                      {block.filename}
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={disabled || block.uploading}
                      onClick={() => replaceFileRefs.current[block.id]?.click()}
                    >
                      {block.uploading ? 'Загрузка…' : 'Заменить'}
                    </Button>
                  </div>
                ) : (
                  <p className="text-caption text-text-muted">
                    {block.uploading ? 'Загрузка…' : 'Файл не выбран'}
                  </p>
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
