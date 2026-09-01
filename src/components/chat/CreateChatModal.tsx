import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { canCreateGroupChat, canCreatePersonalChat } from '@/services/chat/access';
import { useCreateConversation } from '@/hooks/useCreateConversation';
import type { User } from '@/types';
import { formatUserName } from '@/utils';

interface CreateChatModalProps {
  open: boolean;
  onClose: () => void;
  currentUser: User;
  users: User[];
  onCreated: (conversationId: string) => void;
}

type Step = 'choose' | 'personal' | 'group';

export function CreateChatModal({ open, onClose, currentUser, users, onCreated }: CreateChatModalProps) {
  const [step, setStep] = useState<Step>('choose');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [groupTitle, setGroupTitle] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const createMutation = useCreateConversation(currentUser.id);

  const canPersonal = canCreatePersonalChat(currentUser);
  const canGroup = canCreateGroupChat(currentUser);

  const reset = () => {
    setStep('choose');
    setSelectedUserId('');
    setGroupTitle('');
    setSelectedMembers([]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const otherUsers = users.filter((u) => u.id !== currentUser.id);

  const submitPersonal = async () => {
    if (!selectedUserId) return;
    const conv = await createMutation.mutateAsync({
      type: 'personal',
      participantIds: [selectedUserId],
    });
    onCreated(conv.id);
    handleClose();
  };

  const submitGroup = async () => {
    if (!groupTitle.trim() || selectedMembers.length === 0) return;
    const conv = await createMutation.mutateAsync({
      type: 'group',
      title: groupTitle.trim(),
      participantIds: selectedMembers,
    });
    onCreated(conv.id);
    handleClose();
  };

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={step === 'choose' ? 'Новый чат' : step === 'personal' ? 'Личный чат' : 'Новая группа'}
    >
      {step === 'choose' && (
        <div className="flex flex-col gap-2">
          {canPersonal && (
            <Button variant="secondary" className="justify-start" onClick={() => setStep('personal')}>
              Личный чат
            </Button>
          )}
          {canGroup && (
            <Button variant="secondary" className="justify-start" onClick={() => setStep('group')}>
              Группа
            </Button>
          )}
          {!canPersonal && !canGroup && (
            <p className="text-body-sm text-text-muted">У вас нет прав на создание чатов</p>
          )}
        </div>
      )}

      {step === 'personal' && (
        <div className="space-y-4">
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {otherUsers.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setSelectedUserId(u.id)}
                className={`w-full rounded-lg px-3 py-2.5 text-left text-sm focus-ring min-h-[44px] ${
                  selectedUserId === u.id ? 'bg-brand-muted text-brand' : 'hover:bg-surface-elevated'
                }`}
              >
                {formatUserName(u)}
              </button>
            ))}
          </div>
          <Button onClick={submitPersonal} disabled={!selectedUserId} loading={createMutation.isPending} className="w-full">
            Начать чат
          </Button>
        </div>
      )}

      {step === 'group' && (
        <div className="space-y-4">
          <Input
            label="Название группы"
            value={groupTitle}
            onChange={(e) => setGroupTitle(e.target.value)}
            placeholder="Например: Группа вокала"
          />
          <div>
            <p className="mb-2 text-sm font-medium">Участники</p>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {otherUsers.map((u) => (
                <label
                  key={u.id}
                  className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface-elevated"
                >
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(u.id)}
                    onChange={() => toggleMember(u.id)}
                    className="h-4 w-4 accent-brand"
                  />
                  <span className="text-sm">{formatUserName(u)}</span>
                </label>
              ))}
            </div>
          </div>
          <Button
            onClick={submitGroup}
            disabled={!groupTitle.trim() || selectedMembers.length === 0}
            loading={createMutation.isPending}
            className="w-full"
          >
            Создать группу
          </Button>
        </div>
      )}
    </Modal>
  );
}
