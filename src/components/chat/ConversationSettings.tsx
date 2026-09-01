import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/services/api';
import type { Conversation, User } from '@/types';
import { formatUserName } from '@/utils';
import {
  canDeleteConversation,
  canLeaveConversation,
  canManageMembers,
  canUpdateConversation,
} from '@/services/chat/access';
import { useConversationMembers } from '@/hooks/useConversationMembers';
import { Avatar } from '@/components/ui/Avatar';
import { Bell, BellOff, LogOut, Trash2 } from 'lucide-react';

interface ConversationSettingsProps {
  open: boolean;
  onClose: () => void;
  conversation: Conversation;
  currentUser: User;
  users: User[];
  onLeft?: () => void;
  onDeleted?: () => void;
}

export function ConversationSettings({
  open,
  onClose,
  conversation,
  currentUser,
  users,
  onLeft,
  onDeleted,
}: ConversationSettingsProps) {
  const queryClient = useQueryClient();
  const { data: members } = useConversationMembers(conversation.id, currentUser.id);
  const [title, setTitle] = useState(conversation.title);
  const [addUserId, setAddUserId] = useState('');

  const canManage = members ? canManageMembers(currentUser, conversation.id, members) : false;
  const canEdit = members ? canUpdateConversation(currentUser, conversation.id, members) : false;
  const canLeave = members ? canLeaveConversation(currentUser, conversation, members) : false;
  const canDelete = members ? canDeleteConversation(currentUser, conversation.id, members) : false;

  const currentMember = members?.find((m) => m.userId === currentUser.id);
  const isMuted = currentMember?.muted || (currentMember?.mutedUntil && new Date(currentMember.mutedUntil) > new Date());

  const updateMutation = useMutation({
    mutationFn: () => api.chat.updateConversation(conversation.id, currentUser.id, { title: title.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation', conversation.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations', currentUser.id] });
    },
  });

  const muteMutation = useMutation({
    mutationFn: (muted: boolean) =>
      api.chat.muteConversation(conversation.id, currentUser.id, { muted, mutedUntil: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', conversation.id, currentUser.id] });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: (targetUserId: string) =>
      api.chat.addMember(conversation.id, currentUser.id, targetUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', conversation.id, currentUser.id] });
      queryClient.invalidateQueries({ queryKey: ['conversation', conversation.id] });
      setAddUserId('');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (targetUserId: string) =>
      api.chat.removeMember(conversation.id, currentUser.id, targetUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', conversation.id, currentUser.id] });
    },
  });

  const leaveMutation = useMutation({
    mutationFn: () => api.chat.leaveConversation(conversation.id, currentUser.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', currentUser.id] });
      onLeft?.();
      onClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.chat.deleteConversation(conversation.id, currentUser.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', currentUser.id] });
      onDeleted?.();
      onClose();
    },
  });

  const memberUsers = (members ?? [])
    .map((m) => ({ member: m, user: users.find((u) => u.id === m.userId) }))
    .filter((x) => x.user);

  const availableToAdd = users.filter(
    (u) =>
      u.id !== currentUser.id &&
      !conversation.participantIds.includes(u.id),
  );

  return (
    <Modal open={open} onClose={onClose} title="Настройки чата" className="max-w-lg">
      <div className="max-h-[70vh] space-y-6 overflow-y-auto">
        {canEdit && conversation.type !== 'personal' && (
          <div className="space-y-2">
            <Input label="Название" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={!title.trim() || title.trim() === conversation.title}
              loading={updateMutation.isPending}
              size="sm"
            >
              Сохранить
            </Button>
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-medium">Участники ({memberUsers.length})</p>
          <ul className="space-y-2">
            {memberUsers.map(({ member, user }) => (
              <li key={member.userId} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Avatar firstName={user!.firstName} lastName={user!.lastName} size="sm" />
                  <div>
                    <p className="text-sm">{formatUserName(user!)}</p>
                    <p className="text-caption text-text-muted">{member.role}</p>
                  </div>
                </div>
                {canManage && member.userId !== currentUser.id && member.role !== 'owner' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMemberMutation.mutate(member.userId)}
                    loading={removeMemberMutation.isPending}
                  >
                    Удалить
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {canManage && availableToAdd.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Добавить участника</p>
            <select
              value={addUserId}
              onChange={(e) => setAddUserId(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-sm focus-ring min-h-[44px]"
            >
              <option value="">Выберите…</option>
              {availableToAdd.map((u) => (
                <option key={u.id} value={u.id}>
                  {formatUserName(u)}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              disabled={!addUserId}
              loading={addMemberMutation.isPending}
              onClick={() => addUserId && addMemberMutation.mutate(addUserId)}
            >
              Добавить
            </Button>
          </div>
        )}

        <div className="space-y-2 border-t border-border-subtle pt-4">
          <Button
            variant="secondary"
            className="w-full justify-start"
            onClick={() => muteMutation.mutate(!isMuted)}
            loading={muteMutation.isPending}
          >
            {isMuted ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            {isMuted ? 'Включить уведомления' : 'Отключить уведомления'}
          </Button>

          {canLeave && (
            <Button
              variant="secondary"
              className="w-full justify-start text-warning"
              onClick={() => leaveMutation.mutate()}
              loading={leaveMutation.isPending}
            >
              <LogOut className="h-4 w-4" />
              Покинуть чат
            </Button>
          )}

          {canDelete && (
            <Button
              variant="secondary"
              className="w-full justify-start text-danger"
              onClick={() => deleteMutation.mutate()}
              loading={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
              Удалить чат
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
