import { useEffect, useRef } from 'react';
import { Copy, Pencil, Reply, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { Message, User } from '@/types';
import { canDeleteMessage, canEditMessage } from '@/services/chat/messages';

interface MessageActionsProps {
  message: Message;
  user: User;
  isOwn: boolean;
  open: boolean;
  onClose: () => void;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
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
  anchorRef,
}: MessageActionsProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current?.contains(e.target as Node) ||
        anchorRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      onClose();
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [open, onClose, anchorRef]);

  if (!open || message.messageType === 'system') return null;

  const showEdit = isOwn && canEditMessage(user, message);
  const showDelete = canDeleteMessage(user, message);

  const handleCopy = async () => {
    if (message.deletedAt) return;
    try {
      await navigator.clipboard.writeText(message.text);
    } catch {
      /* ignore */
    }
    onClose();
  };

  const actions = [
    { label: 'Ответить', icon: Reply, onClick: () => { onReply(); onClose(); } },
    { label: 'Копировать', icon: Copy, onClick: handleCopy, hidden: !!message.deletedAt },
    { label: 'Редактировать', icon: Pencil, onClick: () => { onEdit(); onClose(); }, hidden: !showEdit },
    { label: 'Удалить', icon: Trash2, onClick: () => { onDelete(); onClose(); }, hidden: !showDelete, danger: true },
  ].filter((a) => !a.hidden);

  return (
    <>
      {/* Desktop contextual menu */}
      <div
        ref={menuRef}
        role="menu"
        className="absolute z-20 hidden min-w-[160px] rounded-xl border border-border-subtle bg-surface-elevated py-1 shadow-lg md:block"
        style={{ top: '100%', right: isOwn ? 0 : 'auto', left: isOwn ? 'auto' : 0 }}
      >
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            role="menuitem"
            onClick={action.onClick}
            className={`flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-surface focus-ring min-h-[44px] ${
              action.danger ? 'text-danger' : 'text-text-primary'
            }`}
          >
            <action.icon className="h-4 w-4" aria-hidden />
            {action.label}
          </button>
        ))}
      </div>

      {/* Mobile bottom sheet */}
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:hidden"
        role="dialog"
        aria-modal
        onClick={onClose}
      >
        <div
          className="w-full rounded-t-2xl border border-border-subtle bg-surface p-4 pb-[calc(1rem+var(--spacing-safe-bottom))]"
          onClick={(e) => e.stopPropagation()}
        >
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-body-sm min-h-[44px] ${
                action.danger ? 'text-danger' : 'text-text-primary'
              }`}
            >
              <action.icon className="h-5 w-5" aria-hidden />
              {action.label}
            </button>
          ))}
          <Button variant="secondary" className="mt-2 w-full" onClick={onClose}>
            Отмена
          </Button>
        </div>
      </div>
    </>
  );
}
