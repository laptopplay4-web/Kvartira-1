import { useEffect, useId, useRef, useState } from 'react';
import { SmilePlus, X } from 'lucide-react';
import { cn } from '@/utils';
import { DIRECTION_ICON_OPTIONS } from '@/services/directions/constants';

interface DirectionIconPickerProps {
  value: string;
  onChange: (icon: string) => void;
  disabled?: boolean;
}

export function DirectionIconPicker({ value, onChange, disabled }: DirectionIconPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="space-y-2">
      <p className="text-body-sm font-medium text-text-primary">Иконка</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-controls={listId}
          aria-haspopup="listbox"
          aria-label={value ? `Иконка ${value}. Изменить` : 'Выбрать иконку'}
          onClick={() => setOpen((prev) => !prev)}
          className={cn(
            'flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border-subtle bg-surface-elevated text-2xl transition-colors focus-ring',
            'hover:bg-surface-hover disabled:opacity-50',
            open && 'border-brand bg-brand-muted',
          )}
        >
          {value ? (
            <span aria-hidden>{value}</span>
          ) : (
            <SmilePlus className="h-5 w-5 text-text-muted" aria-hidden />
          )}
        </button>
        {value ? (
          <button
            type="button"
            disabled={disabled}
            aria-label="Убрать иконку"
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-text-muted hover:bg-surface-hover hover:text-text-primary focus-ring disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : (
          <span className="text-caption text-text-muted">Нажмите, чтобы выбрать эмодзи</span>
        )}
      </div>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label="Эмодзи музыкальной школы"
          className="glass-popup rounded-xl p-2"
        >
          <div className="grid grid-cols-6 gap-1 sm:grid-cols-8">
            {DIRECTION_ICON_OPTIONS.map((emoji) => {
              const selected = value === emoji;
              return (
                <button
                  key={emoji}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-label={`Иконка ${emoji}`}
                  disabled={disabled}
                  onClick={() => {
                    onChange(emoji);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex min-h-11 min-w-11 items-center justify-center rounded-lg text-xl transition-colors focus-ring',
                    selected
                      ? 'bg-brand-muted ring-1 ring-brand'
                      : 'hover:bg-surface-hover',
                  )}
                >
                  <span aria-hidden>{emoji}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
