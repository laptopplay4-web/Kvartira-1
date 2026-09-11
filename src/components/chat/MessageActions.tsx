import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Forward, Pencil, Pin, Reply, SmilePlus, Trash2 } from 'lucide-react';
import { cn } from '@/utils';
import type { Conversation, ConversationMember, Message, User } from '@/types';
import { canDeleteMessage, canEditMessage, canPinMessage } from '@/services/chat/messages';
import { QUICK_REACTION_EMOJIS } from '@/services/chat/constants';

interface MessageActionsProps {
  message: Message;
  user: User;
  isOwn: boolean;
  open: boolean;
  onClose: () => void;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onForward?: () => void;
  onReact?: (emoji: string) => void;
  onPin?: () => void;
  conversation?: Conversation | null;
  members?: ConversationMember[];
  anchorRef: React.RefObject<HTMLElement | null>;
  /** @deprecated glass popup is always used */
  preferSheet?: boolean;
}

const MORE_EMOJIS = ['🔥', '👏', '🎉', '💯', '👀', '🙌', '😎', '🤔', '😭', '😡', '🤝', '✅'];

const PANEL_WIDTH = 280;

export function MessageActions({
  message,
  user,
  isOwn,
  open,
  onClose,
  onReply,
  onEdit,
  onDelete,
  onForward,
  onReact,
  onPin,
  conversation,
  members = [],
  anchorRef,
}: MessageActionsProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [moreReactions, setMoreReactions] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; placeAbove: boolean } | null>(
    null,
  );

  const showEdit = isOwn && canEditMessage(user, message);
  const showDelete = canDeleteMessage(user, message, conversation);
  const showPin =
    !!onPin &&
    !!conversation &&
    canPinMessage(user, members, conversation.id) &&
    !message.deletedAt;
  const isPinned = !!conversation?.pinnedMessageIds?.includes(message.id);

  const items = useMemo(() => {
    if (!open || message.messageType === 'system') return [];

    const list = [
      {
        id: 'reply',
        label: 'Ответить',
        icon: <Reply className="h-4 w-4" aria-hidden />,
        onSelect: onReply,
      },
      {
        id: 'forward',
        label: 'Переслать',
        icon: <Forward className="h-4 w-4" aria-hidden />,
        onSelect: () => onForward?.(),
        disabled: !onForward || !!message.deletedAt,
      },
      {
        id: 'copy',
        label: 'Копировать',
        icon: <Copy className="h-4 w-4" aria-hidden />,
        onSelect: async () => {
          if (message.deletedAt) return;
          try {
            await navigator.clipboard.writeText(message.text);
          } catch {
            /* ignore */
          }
        },
        disabled: !!message.deletedAt || !message.text,
      },
      {
        id: 'pin',
        label: isPinned ? 'Открепить' : 'Закрепить',
        icon: <Pin className="h-4 w-4" aria-hidden />,
        onSelect: () => onPin?.(),
        disabled: !showPin,
      },
      {
        id: 'edit',
        label: 'Редактировать',
        icon: <Pencil className="h-4 w-4" aria-hidden />,
        onSelect: onEdit,
        disabled: !showEdit,
      },
      {
        id: 'delete',
        label: 'Удалить',
        icon: <Trash2 className="h-4 w-4" aria-hidden />,
        onSelect: onDelete,
        destructive: true,
        disabled: !showDelete,
      },
    ];

    return list.filter((item) => !item.disabled);
  }, [
    isPinned,
    message,
    onDelete,
    onEdit,
    onForward,
    onPin,
    onReply,
    open,
    showDelete,
    showEdit,
    showPin,
  ]);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setCoords(null);
      return;
    }
    const rect = anchorRef.current.getBoundingClientRect();
    const estimatedHeight = 320;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceBelow < estimatedHeight && rect.top > spaceBelow;
    const left = Math.min(
      window.innerWidth - PANEL_WIDTH - 12,
      Math.max(12, isOwn ? rect.right - PANEL_WIDTH : rect.left),
    );
    const top = placeAbove
      ? Math.max(12, rect.top - 12)
      : Math.min(window.innerHeight - 24, rect.bottom + 10);
    setCoords({ top, left, placeAbove });
  }, [open, anchorRef, isOwn, items.length, moreReactions]);

  useEffect(() => {
    if (!open) {
      setMoreReactions(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer, true);
    };
  }, [open, onClose]);

  if (!open || message.messageType === 'system' || !coords) return null;

  const emojis = moreReactions ? [...QUICK_REACTION_EMOJIS, ...MORE_EMOJIS] : [...QUICK_REACTION_EMOJIS];

  return createPortal(
    <div className="fixed inset-0 z-sheet pointer-events-none" aria-hidden={false}>
      <div
        className="pointer-events-auto absolute inset-0 glass-scrim motion-safe:animate-fade-in"
        onClick={() => {
          setMoreReactions(false);
          onClose();
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Действия с сообщением"
        className={cn(
          'pointer-events-auto absolute w-[min(280px,calc(100vw-24px))] overflow-hidden glass-popup',
          'motion-safe:animate-fade-in',
          coords.placeAbove && 'origin-bottom -translate-y-full',
        )}
        style={{ top: coords.top, left: coords.left }}
      >
        {onReact && !message.deletedAt && (
          <div className="border-b border-white/10 px-2.5 py-2.5">
            <div className="flex flex-wrap items-center justify-center gap-0.5">
              {emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-xl transition-transform hover:scale-110 hover:bg-white/10 focus-ring active:scale-95"
                  onClick={() => {
                    onReact(emoji);
                    onClose();
                  }}
                  aria-label={`Реакция ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
              {!moreReactions && (
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-white/10 focus-ring"
                  onClick={() => setMoreReactions(true)}
                  aria-label="Ещё реакции"
                >
                  <SmilePlus className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col p-1.5">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                'glass-menu-item flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-left text-body-sm',
                item.destructive
                  ? 'text-danger hover:bg-danger/15'
                  : 'text-text-primary',
              )}
              onClick={() => {
                item.onSelect();
                onClose();
              }}
            >
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                  item.destructive ? 'bg-danger/15' : 'bg-white/10',
                )}
              >
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
