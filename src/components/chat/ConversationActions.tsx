import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, BellOff, Pencil, Pin, PinOff, Trash2 } from 'lucide-react';
import { cn } from '@/utils';
import type { Conversation, User } from '@/types';
import { canManageChats } from '@/services/chat/access';

interface ConversationActionsProps {
  conversation: Conversation;
  user: User;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPin: (pinned: boolean) => void;
  onMute: (muted: boolean) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

const PANEL_WIDTH = 280;

export function ConversationActions({
  conversation,
  user,
  open,
  onClose,
  onEdit,
  onDelete,
  onPin,
  onMute,
  anchorRef,
}: ConversationActionsProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; placeAbove: boolean } | null>(
    null,
  );

  const pinned = !!conversation.viewerPinnedAt;
  const muted = !!conversation.viewerMuted;
  const showDelete = canManageChats(user);

  const items = useMemo(() => {
    if (!open) return [];
    const list = [
      {
        id: 'edit',
        label: 'Редактировать',
        icon: <Pencil className="h-4 w-4" aria-hidden />,
        onSelect: onEdit,
      },
      {
        id: 'pin',
        label: pinned ? 'Открепить' : 'Закрепить',
        icon: pinned ? (
          <PinOff className="h-4 w-4" aria-hidden />
        ) : (
          <Pin className="h-4 w-4" aria-hidden />
        ),
        onSelect: () => onPin(!pinned),
      },
      {
        id: 'notifications',
        label: muted ? 'Включить уведомления' : 'Отключить уведомления',
        icon: muted ? (
          <Bell className="h-4 w-4" aria-hidden />
        ) : (
          <BellOff className="h-4 w-4" aria-hidden />
        ),
        onSelect: () => onMute(!muted),
      },
      {
        id: 'delete',
        label: 'Удалить',
        icon: <Trash2 className="h-4 w-4" aria-hidden />,
        onSelect: onDelete,
        destructive: true as const,
        disabled: !showDelete,
      },
    ];
    return list.filter((item) => !('disabled' in item && item.disabled));
  }, [muted, onDelete, onEdit, onMute, onPin, open, pinned, showDelete]);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setCoords(null);
      return;
    }
    const rect = anchorRef.current.getBoundingClientRect();
    const estimatedHeight = 56 + items.length * 44;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceBelow < estimatedHeight && rect.top > spaceBelow;
    const left = Math.min(
      window.innerWidth - PANEL_WIDTH - 12,
      Math.max(12, rect.left + rect.width / 2 - PANEL_WIDTH / 2),
    );
    const top = placeAbove
      ? Math.max(12, rect.top - 12)
      : Math.min(window.innerHeight - 24, rect.bottom + 8);
    setCoords({ top, left, placeAbove });
  }, [open, anchorRef, items.length]);

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
    <div className="fixed inset-0 z-sheet pointer-events-none" aria-hidden={false}>
      <div
        className="pointer-events-auto absolute inset-0 glass-scrim motion-safe:animate-fade-in"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Действия с чатом"
        className={cn(
          'pointer-events-auto absolute w-[min(280px,calc(100vw-24px))] overflow-hidden glass-popup py-1.5',
          'motion-safe:animate-fade-in',
          coords.placeAbove && 'origin-bottom -translate-y-full',
        )}
        style={{ top: coords.top, left: coords.left }}
      >
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              'glass-menu-item mx-1 flex min-h-11 w-[calc(100%-0.5rem)] items-center gap-3 px-3 py-2.5 text-left text-body-sm',
              'destructive' in item && item.destructive
                ? 'text-danger hover:bg-danger/15'
                : 'text-text-primary',
            )}
            onClick={() => {
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
