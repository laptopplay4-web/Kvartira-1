import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, Copy, Flag, Forward, Pencil, Pin, Reply, SmilePlus, Trash2, UserRound, Users } from 'lucide-react';
import { cn } from '@/utils';
import type { Conversation, ConversationMember, Message, User } from '@/types';
import {
  canDeleteMessageForEveryone,
  canDeleteMessageForMe,
  canEditMessage,
  canPinMessage,
  type DeleteMessageScope,
} from '@/services/chat/messages';
import { canReportMessage } from '@/services/support/reportMessage';
import { QUICK_REACTION_EMOJIS } from '@/services/chat/constants';

interface MessageActionsProps {
  message: Message;
  user: User;
  isOwn: boolean;
  open: boolean;
  onClose: () => void;
  onReply: () => void;
  onEdit: () => void;
  onDelete: (scope: DeleteMessageScope) => void;
  onReport?: () => void;
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
const PANEL_ESTIMATED_HEIGHT = 320;
const EDGE_GAP = 12;
/** Extra bottom inset: composer / home indicator when BottomNav hidden in /chat/:id */
const BOTTOM_EXTRA = 24;

function readSafeInsetBottom(): number {
  if (typeof window === 'undefined' || typeof getComputedStyle === 'undefined') return 0;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--spacing-safe-bottom')
    .trim();
  if (raw.endsWith('px')) {
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function computePanelCoords(
  anchor: DOMRect,
  panelHeight: number,
  isOwnMessage: boolean,
): { top: number; left: number; placeAbove: boolean } {
  const minTop = EDGE_GAP;
  const maxBottom = window.innerHeight - EDGE_GAP - readSafeInsetBottom() - BOTTOM_EXTRA;
  const gap = 10;

  const spaceBelow = maxBottom - (anchor.bottom + gap);
  const spaceAbove = anchor.top - gap - minTop;
  const fitsBelow = spaceBelow >= panelHeight;
  const fitsAbove = spaceAbove >= panelHeight;
  const placeAbove = !fitsBelow && (fitsAbove || spaceAbove > spaceBelow);

  const left = Math.min(
    window.innerWidth - PANEL_WIDTH - EDGE_GAP,
    Math.max(EDGE_GAP, isOwnMessage ? anchor.right - PANEL_WIDTH : anchor.left),
  );

  if (placeAbove) {
    // With `-translate-y-full`, `top` is the bottom edge of the panel.
    let top = anchor.top - gap;
    if (top - panelHeight < minTop) top = minTop + panelHeight;
    if (top > maxBottom) top = maxBottom;
    return { top, left, placeAbove: true };
  }

  let top = anchor.bottom + gap;
  if (top + panelHeight > maxBottom) top = maxBottom - panelHeight;
  if (top < minTop) top = minTop;
  return { top, left, placeAbove: false };
}

export function MessageActions({
  message,
  user,
  isOwn,
  open,
  onClose,
  onReply,
  onEdit,
  onDelete,
  onReport,
  onForward,
  onReact,
  onPin,
  conversation,
  members = [],
  anchorRef,
}: MessageActionsProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [moreReactions, setMoreReactions] = useState(false);
  const [deleteMenu, setDeleteMenu] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; placeAbove: boolean } | null>(
    null,
  );

  const showEdit = isOwn && canEditMessage(user, message);
  const showDeleteForMe = canDeleteMessageForMe(user, message, conversation, members);
  const showDeleteForEveryone = canDeleteMessageForEveryone(user, message, conversation);
  const showDeleteEntry = showDeleteForMe || showDeleteForEveryone;
  const showReport =
    !!onReport && canReportMessage(user, message, conversation, members);
  const showPin =
    !!onPin &&
    !!conversation &&
    canPinMessage(user, members, conversation.id) &&
    !message.deletedAt;
  const isPinned = !!conversation?.pinnedMessageIds?.includes(message.id);

  const items = useMemo(() => {
    if (!open || message.messageType === 'system') return [];

    if (deleteMenu) {
      const deleteItems = [
        {
          id: 'delete-back',
          label: 'Назад',
          icon: <ChevronLeft className="h-4 w-4" aria-hidden />,
          onSelect: () => setDeleteMenu(false),
          destructive: false,
          keepOpen: true,
        },
        {
          id: 'delete-me',
          label: 'Удалить у себя',
          icon: <UserRound className="h-4 w-4" aria-hidden />,
          onSelect: () => onDelete('me'),
          destructive: true,
          disabled: !showDeleteForMe,
        },
        {
          id: 'delete-everyone',
          label: 'Удалить у всех',
          icon: <Users className="h-4 w-4" aria-hidden />,
          onSelect: () => onDelete('everyone'),
          destructive: true,
          disabled: !showDeleteForEveryone,
        },
      ];
      return deleteItems.filter((item) => !('disabled' in item && item.disabled));
    }

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
        id: 'report',
        label: 'Пожаловаться',
        icon: <Flag className="h-4 w-4" aria-hidden />,
        onSelect: () => onReport?.(),
        disabled: !showReport,
      },
      {
        id: 'delete',
        label: 'Удалить',
        icon: <Trash2 className="h-4 w-4" aria-hidden />,
        onSelect: () => setDeleteMenu(true),
        destructive: true,
        keepOpen: true,
        disabled: !showDeleteEntry,
      },
    ];

    return list.filter((item) => !item.disabled);
  }, [
    deleteMenu,
    isPinned,
    message,
    onDelete,
    onEdit,
    onForward,
    onPin,
    onReply,
    onReport,
    open,
    showDeleteEntry,
    showDeleteForEveryone,
    showDeleteForMe,
    showEdit,
    showPin,
    showReport,
  ]);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setCoords(null);
      return;
    }

    const place = (height: number) => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      setCoords(computePanelCoords(rect, height, isOwn));
    };

    place(panelRef.current?.offsetHeight || PANEL_ESTIMATED_HEIGHT);

    const raf = requestAnimationFrame(() => {
      const measured = panelRef.current?.offsetHeight;
      if (measured && measured > 0) place(measured);
    });
    return () => cancelAnimationFrame(raf);
  }, [open, anchorRef, isOwn, items.length, moreReactions, deleteMenu]);

  useEffect(() => {
    if (!open) {
      setMoreReactions(false);
      setDeleteMenu(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deleteMenu) {
          setDeleteMenu(false);
          return;
        }
        onClose();
      }
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
  }, [open, onClose, deleteMenu]);

  if (!open || message.messageType === 'system' || !coords) return null;

  const emojis = moreReactions ? [...QUICK_REACTION_EMOJIS, ...MORE_EMOJIS] : [...QUICK_REACTION_EMOJIS];

  return createPortal(
    <div className="fixed inset-0 z-sheet pointer-events-none" aria-hidden={false}>
      <div
        className="pointer-events-auto absolute inset-0 glass-scrim motion-safe:animate-fade-in"
        onClick={() => {
          setMoreReactions(false);
          setDeleteMenu(false);
          onClose();
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-label={deleteMenu ? 'Удаление сообщения' : 'Действия с сообщением'}
        className={cn(
          'pointer-events-auto absolute w-[min(280px,calc(100vw-24px))] max-h-[min(70dvh,calc(100dvh-48px))] overflow-x-hidden overflow-y-auto overscroll-contain scrollbar-none glass-popup',
          'motion-safe:animate-fade-in',
          coords.placeAbove && 'origin-bottom -translate-y-full',
        )}
        style={{ top: coords.top, left: coords.left }}
      >
        {onReact && !message.deletedAt && !deleteMenu && (
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
                if (!('keepOpen' in item && item.keepOpen)) onClose();
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
