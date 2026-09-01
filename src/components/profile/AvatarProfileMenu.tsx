import { useEffect } from 'react';

import { Crop, ImagePlus, Maximize2, Trash2 } from 'lucide-react';

import { cn } from '@/utils';

interface AvatarProfileMenuProps {
  open: boolean;
  hasAvatar: boolean;
  disabled?: boolean;
  removing?: boolean;
  onOpenPhoto: () => void;
  onChangePhoto: () => void;
  onChangeThumbnail: () => void;
  onRemove: () => void;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

const menuItems = [
  {
    id: 'open',
    label: 'Открыть фото',
    icon: Maximize2,
    tone: 'brand' as const,
    requiresAvatar: true,
  },
  {
    id: 'change',
    label: 'Изменить фото',
    icon: ImagePlus,
    tone: 'brand' as const,
    requiresAvatar: false,
  },
  {
    id: 'thumbnail',
    label: 'Изменить миниатюру',
    icon: Crop,
    tone: 'brand' as const,
    requiresAvatar: false,
  },
  {
    id: 'remove',
    label: 'Удалить фото',
    icon: Trash2,
    tone: 'danger' as const,
    requiresAvatar: true,
  },
] as const;

export function AvatarProfileMenu({
  open,
  hasAvatar,
  disabled,
  removing,
  onOpenPhoto,
  onChangePhoto,
  onChangeThumbnail,
  onRemove,
  onClose,
  onMouseEnter,
  onMouseLeave,
}: AvatarProfileMenuProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handlers: Record<(typeof menuItems)[number]['id'], () => void> = {
    open: onOpenPhoto,
    change: onChangePhoto,
    thumbnail: onChangeThumbnail,
    remove: onRemove,
  };

  return (
    <div
      className={cn(
        'absolute left-1/2 top-[calc(100%+0.75rem)] z-50 w-60 -translate-x-1/2 transition-all duration-200 ease-out',
        open
          ? 'pointer-events-auto translate-y-0 opacity-100'
          : 'pointer-events-none -translate-y-1 opacity-0',
      )}
      role="menu"
      aria-label="Действия с фото профиля"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-elevated p-1.5 shadow-xl">
        {menuItems.map((item) => {
          if (item.requiresAvatar && !hasAvatar) return null;

          const Icon = item.icon;
          const isDanger = item.tone === 'danger';
          const isRemove = item.id === 'remove';

          return (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={disabled || (isRemove && removing)}
              onClick={handlers[item.id]}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-body-sm transition-colors min-h-11',
                isDanger
                  ? 'text-danger hover:bg-danger-muted active:bg-danger-muted disabled:opacity-50'
                  : 'text-text-primary hover:bg-surface-hover active:bg-surface-hover disabled:opacity-50',
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                  isDanger ? 'bg-danger-muted text-danger' : 'bg-brand-muted text-brand',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="font-medium">{isRemove && removing ? 'Удаление…' : item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
