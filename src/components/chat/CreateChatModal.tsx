import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StudentPickerList } from '@/components/users/StudentPickerList';
import { ChatAvatarEditor } from '@/components/chat/ChatAvatarEditor';
import {
  canCreateGroupChat,
  canCreatePersonalChat,
  canCreateSchoolWideChat,
} from '@/services/chat/access';
import { SCHOOL_WIDE_CHAT_DEFAULT_TITLE } from '@/services/chat/constants';
import { useCreateConversation } from '@/hooks/useCreateConversation';
import { api } from '@/services/api';
import type { User } from '@/types';

interface CreateChatModalProps {
  open: boolean;
  onClose: () => void;
  currentUser: User;
  users: User[];
  onCreated: (conversationId: string) => void;
}

type Step = 'choose' | 'personal' | 'group' | 'school';

export function CreateChatModal({ open, onClose, currentUser, users, onCreated }: CreateChatModalProps) {
  const [step, setStep] = useState<Step>('choose');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const createMutation = useCreateConversation(currentUser.id);

  const { data: directions = [] } = useQuery({
    queryKey: ['directions'],
    queryFn: () => api.lessons.getDirections(),
    enabled: open,
  });

  const canPersonal = canCreatePersonalChat(currentUser);
  const canGroup = canCreateGroupChat(currentUser);
  const canSchoolWide = canCreateSchoolWideChat(currentUser);
  const students = users
    .filter((u) => u.role === 'student')
    .sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`, 'ru'));

  useEffect(() => {
    if (!open) return;
    setStep('choose');
    setSelectedUserIds([]);
    setTitle('');
    setAvatarUrl('');
    setAvatarError('');
    setSubmitError('');
    // Do not reset mutation here — can abort in-flight school-wide create on remount
  }, [open]);

  const openSetup = (next: 'personal' | 'group' | 'school') => {
    setSelectedUserIds([]);
    setTitle(next === 'school' ? SCHOOL_WIDE_CHAT_DEFAULT_TITLE : '');
    setAvatarUrl('');
    setAvatarError('');
    setSubmitError('');
    setStep(next);
  };

  const finishCreated = (conversationId: string) => {
    onClose();
    onCreated(conversationId);
  };

  const submitPersonal = async () => {
    const studentId = selectedUserIds[0];
    if (!studentId || createMutation.isPending) return;
    setSubmitError('');
    try {
      const conv = await createMutation.mutateAsync({
        type: 'personal',
        participantIds: [studentId],
      });
      finishCreated(conv.id);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Не удалось создать чат');
    }
  };

  const submitGroup = async () => {
    if (!title.trim() || selectedUserIds.length === 0 || createMutation.isPending) return;
    setSubmitError('');
    try {
      const conv = await createMutation.mutateAsync({
        type: 'group',
        title: title.trim(),
        participantIds: selectedUserIds,
        ...(avatarUrl ? { avatarUrl } : {}),
      });
      finishCreated(conv.id);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Не удалось создать группу');
    }
  };

  const submitSchoolWide = async () => {
    if (!title.trim() || createMutation.isPending) return;
    setSubmitError('');
    try {
      const conv = await createMutation.mutateAsync({
        type: 'group',
        title: title.trim(),
        // Pass visible directory so PB does not re-fetch + getOne every user (RBAC/hangs)
        participantIds: users.map((u) => u.id),
        allUsers: true,
        ...(avatarUrl ? { avatarUrl } : {}),
      });
      finishCreated(conv.id);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Не удалось создать общий чат');
    }
  };

  const modalTitle =
    step === 'choose'
      ? 'Новый чат'
      : step === 'personal'
        ? 'Личный чат'
        : step === 'group'
          ? 'Новая группа'
          : 'Общий чат';

  const stepFooter =
    step === 'personal' ? (
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => setStep('choose')}>
          Назад
        </Button>
        <Button
          className="flex-1"
          onClick={() => void submitPersonal()}
          disabled={selectedUserIds.length === 0}
          loading={createMutation.isPending}
        >
          Начать чат
        </Button>
      </div>
    ) : step === 'group' || step === 'school' ? (
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => setStep('choose')}>
          Назад
        </Button>
        <Button
          className="flex-1"
          onClick={() => void (step === 'school' ? submitSchoolWide() : submitGroup())}
          disabled={!title.trim() || (step === 'group' && selectedUserIds.length === 0)}
          loading={createMutation.isPending}
        >
          {step === 'school' ? 'Создать общий чат' : 'Создать группу'}
        </Button>
      </div>
    ) : undefined;

  return (
    <Modal open={open} onClose={onClose} title={modalTitle} size="lg" footer={stepFooter}>
      {step === 'choose' && (
        <div className="flex flex-col gap-2">
          {canPersonal && (
            <Button variant="secondary" className="justify-start" onClick={() => openSetup('personal')}>
              Личный чат с учеником
            </Button>
          )}
          {canGroup && (
            <Button variant="secondary" className="justify-start" onClick={() => openSetup('group')}>
              Группа
            </Button>
          )}
          {canSchoolWide && (
            <Button variant="secondary" className="justify-start" onClick={() => openSetup('school')}>
              Общий чат для всех
            </Button>
          )}
          {!canPersonal && !canGroup && !canSchoolWide && (
            <p className="text-body-sm text-text-muted">У вас нет прав на создание чатов</p>
          )}
        </div>
      )}

      {step === 'personal' && (
        <div className="flex flex-col gap-4">
          <StudentPickerList
            students={students}
            directions={directions}
            selectedIds={selectedUserIds}
            onChange={setSelectedUserIds}
            mode="single"
            disabled={createMutation.isPending}
            emptyAllLabel="Нет учеников для чата"
          />
          {submitError && <p className="text-caption text-danger">{submitError}</p>}
        </div>
      )}

      {(step === 'group' || step === 'school') && (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <ChatAvatarEditor
              value={avatarUrl}
              onChange={setAvatarUrl}
              onError={setAvatarError}
              disabled={createMutation.isPending}
            />
            <div className="min-w-0 flex-1 space-y-2">
              <Input
                label="Название чата"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  step === 'school' ? SCHOOL_WIDE_CHAT_DEFAULT_TITLE : 'Например: Группа вокала'
                }
              />
              {avatarError && <p className="text-caption text-danger">{avatarError}</p>}
            </div>
          </div>

          {step === 'school' ? (
            <p className="rounded-xl bg-surface-elevated px-3 py-3 text-body-sm text-text-secondary">
              В чат будут добавлены все пользователи школы.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Участники</p>
              <StudentPickerList
                students={students}
                directions={directions}
                selectedIds={selectedUserIds}
                onChange={setSelectedUserIds}
                mode="multiple"
                disabled={createMutation.isPending}
                emptyAllLabel="Нет учеников для группы"
              />
            </div>
          )}

          {submitError && <p className="text-caption text-danger">{submitError}</p>}
        </div>
      )}
    </Modal>
  );
}
