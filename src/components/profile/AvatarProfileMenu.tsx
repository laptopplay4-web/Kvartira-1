import { useMemo } from 'react';
import { ImagePlus, Maximize2, Trash2 } from 'lucide-react';
import { DropdownMenu, type DropdownMenuItem } from '@/components/ui/DropdownMenu';

interface AvatarProfileMenuProps {
  open: boolean;
  hasAvatar: boolean;
  disabled?: boolean;
  removing?: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  onOpenPhoto: () => void;
  onChangePhoto: () => void;
  onRemove: () => void;
  onClose: () => void;
}

export function AvatarProfileMenu({
  open,
  hasAvatar,
  disabled,
  removing,
  anchorRef,
  onOpenPhoto,
  onChangePhoto,
  onRemove,
  onClose,
}: AvatarProfileMenuProps) {
  const items = useMemo(() => {
    const list: DropdownMenuItem[] = [];

    if (hasAvatar) {
      list.push({
        id: 'open',
        label: 'Открыть фото',
        icon: <Maximize2 className="h-4 w-4" aria-hidden />,
        onSelect: onOpenPhoto,
        disabled,
      });
    }

    list.push({
      id: 'change',
      label: 'Изменить фото',
      icon: <ImagePlus className="h-4 w-4" aria-hidden />,
      onSelect: onChangePhoto,
      disabled,
    });

    if (hasAvatar) {
      list.push({
        id: 'remove',
        label: removing ? 'Удаление…' : 'Удалить фото',
        icon: <Trash2 className="h-4 w-4" aria-hidden />,
        onSelect: onRemove,
        destructive: true,
        disabled: disabled || removing,
      });
    }

    return list;
  }, [disabled, hasAvatar, onChangePhoto, onOpenPhoto, onRemove, removing]);

  if (!open) return null;

  return (
    <DropdownMenu
      open={open}
      onClose={onClose}
      items={items}
      anchorRef={anchorRef}
      align="start"
    />
  );
}
