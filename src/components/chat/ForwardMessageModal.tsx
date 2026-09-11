import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { Conversation, User } from '@/types';
import { getConversationDisplayTitle, isGroupLike } from '@/services/chat/helpers';
import { cn } from '@/utils';

interface ForwardMessageModalProps {
  open: boolean;
  onClose: () => void;
  conversations: Conversation[];
  currentUserId: string;
  users: User[];
  excludeConversationId?: string;
  onForward: (conversationIds: string[]) => void;
  loading?: boolean;
}

export function ForwardMessageModal({
  open,
  onClose,
  conversations,
  currentUserId,
  users,
  excludeConversationId,
  onForward,
  loading,
}: ForwardMessageModalProps) {
  const [selected, setSelected] = useState<string[]>([]);

  const options = useMemo(
    () =>
      conversations.filter(
        (c) => c.id !== excludeConversationId && c.participantIds.includes(currentUserId),
      ),
    [conversations, currentUserId, excludeConversationId],
  );

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        setSelected([]);
        onClose();
      }}
      title="Переслать"
    >
      <div className="space-y-3">
        <p className="text-body-sm text-text-secondary">Выберите чат — сообщение скопируется без указания автора.</p>
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {options.map((conv) => {
            const title = getConversationDisplayTitle(conv, currentUserId, users);
            const active = selected.includes(conv.id);
            return (
              <li key={conv.id}>
                <button
                  type="button"
                  onClick={() => toggle(conv.id)}
                  className={cn(
                    'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left focus-ring',
                    active ? 'bg-brand-muted text-brand' : 'hover:bg-surface-elevated',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-full border text-caption',
                      active ? 'border-brand bg-brand text-brand-contrast' : 'border-border',
                    )}
                    aria-hidden
                  >
                    {active ? '✓' : ''}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
                  {isGroupLike(conv) && (
                    <span className="text-caption text-text-muted">группа</span>
                  )}
                </button>
              </li>
            );
          })}
          {options.length === 0 && (
            <li className="py-6 text-center text-body-sm text-text-muted">Нет доступных чатов</li>
          )}
        </ul>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            className="min-h-11 flex-1"
            onClick={() => {
              setSelected([]);
              onClose();
            }}
          >
            Отмена
          </Button>
          <Button
            className="min-h-11 flex-1"
            disabled={selected.length === 0 || loading}
            loading={loading}
            onClick={() => {
              onForward(selected);
              setSelected([]);
            }}
          >
            Переслать
          </Button>
        </div>
      </div>
    </Modal>
  );
}
