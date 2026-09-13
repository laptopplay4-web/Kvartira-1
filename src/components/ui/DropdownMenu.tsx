import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/utils';

export interface DropdownMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

interface DropdownMenuProps {
  open: boolean;
  onClose: () => void;
  items: DropdownMenuItem[];
  /** Anchor element for positioning; menu renders in a portal. */
  anchorRef: React.RefObject<HTMLElement | null>;
  align?: 'start' | 'end';
  className?: string;
}

export function DropdownMenu({
  open,
  onClose,
  items,
  anchorRef,
  align = 'end',
  className,
}: DropdownMenuProps) {
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open || !anchorRef.current) {
      setCoords(null);
      return;
    }
    const rect = anchorRef.current.getBoundingClientRect();
    const width = 220;
    const left =
      align === 'end'
        ? Math.min(window.innerWidth - width - 8, Math.max(8, rect.right - width))
        : Math.min(window.innerWidth - width - 8, Math.max(8, rect.left));
    setCoords({ top: rect.bottom + 8, left });
  }, [open, anchorRef, align]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !coords) return null;

  return createPortal(
    <div className="fixed inset-0 z-dropdown" role="presentation">
      <div className="absolute inset-0 glass-scrim animate-fade-in" onClick={onClose} aria-hidden />
      <div
        ref={menuRef}
        id={menuId}
        role="menu"
        style={{ top: coords.top, left: coords.left }}
        className={cn(
          'absolute w-[220px] max-w-[calc(100vw-16px)] overflow-x-hidden overflow-y-auto scrollbar-none glass-popup py-1.5 animate-scale-in',
          className,
        )}
      >
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            className={cn(
              'glass-menu-item mx-1 flex w-[calc(100%-0.5rem)] items-center gap-3 px-3 py-2.5 text-left text-body-sm',
              'disabled:opacity-50',
              item.destructive ? 'text-danger hover:bg-danger/15' : 'text-text-primary',
            )}
            onClick={() => {
              if (item.disabled) return;
              item.onSelect();
              onClose();
            }}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}
