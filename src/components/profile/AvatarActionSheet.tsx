import { ImagePlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';

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
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Действия с фото"
      size="sm"
      footer={
        <Button variant="secondary" className="w-full" onClick={onClose}>
          Отмена
        </Button>
      }
    >
      <div className="flex flex-col gap-1 px-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            onUpload();
            onClose();
          }}
          className="flex min-h-11 w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-body-sm font-medium text-text-primary transition-colors hover:bg-surface-hover focus-ring"
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
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-body-sm font-medium text-danger transition-colors hover:bg-danger-muted focus-ring disabled:opacity-50"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-danger-muted">
              <Trash2 className="h-5 w-5" aria-hidden />
            </span>
            {removing ? 'Удаление…' : 'Удалить фото'}
          </button>
        )}
      </div>
    </Sheet>
  );
}
