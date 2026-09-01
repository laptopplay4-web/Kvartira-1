import { useEffect } from 'react';

import { ImagePlus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/Button';

interface AvatarActionSheetProps {
  open: boolean;
  hasAvatar: boolean;
  disabled?: boolean;
  removing?: boolean;
  onClose: () => void;
  onUpload: () => void;
  onRemove: () => void;
}

export function AvatarActionSheet({
  open,
  hasAvatar,
  disabled,
  removing,
  onClose,
  onUpload,
  onRemove,
}: AvatarActionSheetProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal
      aria-label="Действия с фото"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg sm:rounded-2xl sm:border sm:border-border-subtle sm:shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-t-2xl bg-surface-elevated px-2 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-2 sm:rounded-2xl">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden />

          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onUpload();
              onClose();
            }}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-body-sm font-medium text-text-primary transition-colors hover:bg-surface-hover min-h-11"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-muted text-brand">
              <ImagePlus className="h-5 w-5" aria-hidden />
            </span>
            Загрузить фото
          </button>

          {hasAvatar && (
            <button
              type="button"
              disabled={disabled || removing}
              onClick={() => {
                onRemove();
                onClose();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-body-sm font-medium text-danger transition-colors hover:bg-danger-muted min-h-11 disabled:opacity-50"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-danger-muted">
                <Trash2 className="h-5 w-5" aria-hidden />
              </span>
              {removing ? 'Удаление…' : 'Удалить фото'}
            </button>
          )}

          <Button variant="secondary" className="mt-2 w-full" onClick={onClose}>
            Отмена
          </Button>
        </div>
      </div>
    </div>
  );
}
