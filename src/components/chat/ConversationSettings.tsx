import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ChatAvatarEditor } from '@/components/chat/ChatAvatarEditor';
import { api } from '@/services/api';
import type { Conversation, ConversationMember, User } from '@/types';
import { formatUserName } from '@/utils';
import { getRoleLabel } from '@/permissions';
import { filterUsersBySearchQuery } from '@/services/users/helpers';
import {
  canDeleteConversation,
  canLeaveConversation,
  canManageMembers,
  canUpdateConversation,
  isMemberMuted,
} from '@/services/chat/access';
import { isSchoolWideConversation } from '@/services/chat/schoolWide';
import { sortConversationsWithPins } from '@/services/chat/helpers';
import { useConversationMembers } from '@/hooks/useConversationMembers';
import { Avatar } from '@/components/ui/Avatar';
import { Bell, BellOff, LogOut, Pin, Search, Trash2 } from 'lucide-react';
import { UserPreviewTrigger } from '@/components/users/UserPreviewTrigger';

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
  const [avatarUrl, setAvatarUrl] = useState(conversation.avatarUrl ?? '');
  const [avatarError, setAvatarError] = useState('');
  const [memberQuery, setMemberQuery] = useState('');
  const [addQuery, setAddQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle(conversation.title);
    setAvatarUrl(conversation.avatarUrl ?? '');
    setAvatarError('');
    setMemberQuery('');
    setAddQuery('');
  }, [open, conversation.id, conversation.title, conversation.avatarUrl]);

  const schoolWide = isSchoolWideConversation(conversation);
  const canManage = members
    ? canManageMembers(currentUser, conversation.id, members, conversation)
    : false;
  const canEdit = members ? canUpdateConversation(currentUser, conversation.id, members) : false;
  const canLeave = members ? canLeaveConversation(currentUser, conversation, members) : false;
  const canDelete = members ? canDeleteConversation(currentUser, conversation.id, members) : false;

  const currentMember = members?.find((m) => m.userId === currentUser.id);
  const isMuted = currentMember
    ? isMemberMuted(currentMember)
    : !!conversation.viewerMuted;

  const titleChanged = title.trim() !== conversation.title;
  const avatarChanged = (avatarUrl || '') !== (conversation.avatarUrl ?? '');
  const canSaveProfile = titleChanged || avatarChanged;

  const updateMutation = useMutation({
    mutationFn: () =>
      api.chat.updateConversation(conversation.id, currentUser.id, {
        ...(titleChanged ? { title: title.trim() } : {}),
        ...(avatarChanged ? { avatarUrl } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation', conversation.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations', currentUser.id] });
    },
  });

  const muteMutation = useMutation({
    mutationFn: (muted: boolean) =>
      api.chat.muteConversation(conversation.id, currentUser.id, { muted, mutedUntil: null }),
    onMutate: async (muted) => {
      await queryClient.cancelQueries({ queryKey: ['conversations', currentUser.id] });
      await queryClient.cancelQueries({
        queryKey: ['members', conversation.id, currentUser.id],
      });
      const prevConversations = queryClient.getQueryData<Conversation[]>([
        'conversations',
        currentUser.id,
      ]);
      const prevMembers = queryClient.getQueryData<ConversationMember[]>([
        'members',
        conversation.id,
        currentUser.id,
      ]);
      queryClient.setQueryData<Conversation[]>(['conversations', currentUser.id], (old) =>
        (old ?? []).map((c) =>
          c.id === conversation.id ? { ...c, viewerMuted: muted } : c,
        ),
      );
      queryClient.setQueryData<ConversationMember[]>(
        ['members', conversation.id, currentUser.id],
        (old) =>
          (old ?? []).map((m) =>
            m.userId === currentUser.id
              ? { ...m, muted, mutedUntil: muted ? m.mutedUntil : null }
              : m,
          ),
      );
      return { prevConversations, prevMembers };
    },
    onError: (_err, _muted, ctx) => {
      if (ctx?.prevConversations) {
        queryClient.setQueryData(['conversations', currentUser.id], ctx.prevConversations);
      }
      if (ctx?.prevMembers) {
        queryClient.setQueryData(
          ['members', conversation.id, currentUser.id],
          ctx.prevMembers,
        );
      }
    },
    onSuccess: (member) => {
      queryClient.setQueryData<Conversation[]>(['conversations', currentUser.id], (old) =>
        (old ?? []).map((c) =>
          c.id === conversation.id ? { ...c, viewerMuted: isMemberMuted(member) } : c,
        ),
      );
      queryClient.setQueryData<ConversationMember[]>(
        ['members', conversation.id, currentUser.id],
        (old) =>
          (old ?? []).map((m) =>
            m.userId === currentUser.id ? { ...m, ...member } : m,
          ),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['members', conversation.id, currentUser.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations', currentUser.id] });
    },
  });

  const pinListMutation = useMutation({
    mutationFn: (pinned: boolean) =>
      api.chat.pinConversation(conversation.id, currentUser.id, pinned),
    onMutate: async (pinned) => {
      await queryClient.cancelQueries({ queryKey: ['conversations', currentUser.id] });
      await queryClient.cancelQueries({
        queryKey: ['members', conversation.id, currentUser.id],
      });
      const prevConversations = queryClient.getQueryData<Conversation[]>([
        'conversations',
        currentUser.id,
      ]);
      const prevMembers = queryClient.getQueryData<ConversationMember[]>([
        'members',
        conversation.id,
        currentUser.id,
      ]);
      const pinnedAt = pinned ? new Date().toISOString() : null;
      queryClient.setQueryData<Conversation[]>(['conversations', currentUser.id], (old) => {
        const next = (old ?? []).map((c) =>
          c.id === conversation.id ? { ...c, viewerPinnedAt: pinnedAt } : c,
        );
        return sortConversationsWithPins(next, [], currentUser.id);
      });
      queryClient.setQueryData<ConversationMember[]>(
        ['members', conversation.id, currentUser.id],
        (old) =>
          (old ?? []).map((m) =>
            m.userId === currentUser.id ? { ...m, pinnedAt } : m,
          ),
      );
      return { prevConversations, prevMembers };
    },
    onError: (_err, _pinned, ctx) => {
      if (ctx?.prevConversations) {
        queryClient.setQueryData(['conversations', currentUser.id], ctx.prevConversations);
      }
      if (ctx?.prevMembers) {
        queryClient.setQueryData(
          ['members', conversation.id, currentUser.id],
          ctx.prevMembers,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['members', conversation.id, currentUser.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations', currentUser.id] });
    },
  });

  const isListPinned = !!(currentMember?.pinnedAt || conversation.viewerPinnedAt);

  const addMemberMutation = useMutation({
    mutationFn: (targetUserId: string) =>
      api.chat.addMember(conversation.id, currentUser.id, targetUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', conversation.id, currentUser.id] });
      queryClient.invalidateQueries({ queryKey: ['conversation', conversation.id] });
      setAddQuery('');
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

  const memberUsers = useMemo(() => {
    const rows: { member: ConversationMember; user: User }[] = [];
    for (const member of members ?? []) {
      const user = users.find((u) => u.id === member.userId);
      if (user) rows.push({ member, user });
    }
    return rows;
  }, [members, users]);

  const visibleMembers = useMemo(() => {
    const matched = new Set(
      filterUsersBySearchQuery(
        memberUsers.map((x) => x.user),
        memberQuery,
      ).map((u) => u.id),
    );
    return memberUsers.filter((x) => matched.has(x.user.id));
  }, [memberUsers, memberQuery]);

  const availableToAdd = useMemo(
    () =>
      users.filter(
        (u) => u.id !== currentUser.id && !conversation.participantIds.includes(u.id),
      ),
    [users, currentUser.id, conversation.participantIds],
  );

  const visibleToAdd = useMemo(
    () =>
      [...filterUsersBySearchQuery(availableToAdd, addQuery)].sort((a, b) =>
        formatUserName(a).localeCompare(formatUserName(b), 'ru'),
      ),
    [availableToAdd, addQuery],
  );

  return (
    <Modal open={open} onClose={onClose} title="Настройки чата" size="lg">
      <div className="space-y-6">
        {canEdit && conversation.type !== 'personal' && (
          <div className="space-y-3">
            <div className="flex items-start gap-4">
              <ChatAvatarEditor
                value={avatarUrl}
                onChange={setAvatarUrl}
                onError={setAvatarError}
                disabled={updateMutation.isPending}
              />
              <div className="min-w-0 flex-1 space-y-2">
                <Input label="Название" value={title} onChange={(e) => setTitle(e.target.value)} />
                {avatarError && <p className="text-caption text-danger">{avatarError}</p>}
              </div>
            </div>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={!title.trim() || !canSaveProfile}
              loading={updateMutation.isPending}
              size="sm"
            >
              Сохранить
            </Button>
          </div>
        )}

        {schoolWide ? (
          <p className="rounded-xl bg-surface-elevated px-3 py-3 text-body-sm text-text-secondary">
            Общий чат школы — список участников не отображается. Все пользователи школы входят в
            него автоматически.
          </p>
        ) : conversation.type === 'personal' ? null : (
          <>
            <div>
              <p className="mb-2 text-sm font-medium">Участники ({memberUsers.length})</p>
              {memberUsers.length > 0 && (
                <div className="relative mb-2">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={memberQuery}
                    onChange={(e) => setMemberQuery(e.target.value)}
                    placeholder="Поиск по имени или телефону"
                    aria-label="Поиск участника"
                    className="w-full rounded-xl border border-border bg-surface-elevated py-2.5 pl-10 pr-4 text-sm focus-ring"
                  />
                </div>
              )}
              <ul className="popup-scroll max-h-48 space-y-2">
                {visibleMembers.length > 0 ? (
                  visibleMembers.map(({ member, user }) => (
                    <li key={member.userId} className="flex items-center justify-between gap-2">
                      <UserPreviewTrigger
                        user={user}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-xl p-0"
                      >
                        <Avatar
                          src={user.avatarUrl}
                          firstName={user.firstName}
                          lastName={user.lastName}
                          size="sm"
                        />
                        <div className="min-w-0 text-left">
                          <p className="truncate text-sm">{formatUserName(user)}</p>
                          <p className="text-caption text-text-muted">{getRoleLabel(user.role)}</p>
                        </div>
                      </UserPreviewTrigger>
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
                  ))
                ) : (
                  <li className="py-4 text-center text-body-sm text-text-muted">
                    {memberQuery.trim() ? 'Ничего не найдено' : 'Нет участников'}
                  </li>
                )}
              </ul>
            </div>

            {canManage && availableToAdd.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Добавить участника</p>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={addQuery}
                    onChange={(e) => setAddQuery(e.target.value)}
                    placeholder="Поиск по имени или телефону"
                    aria-label="Поиск пользователя для добавления"
                    className="w-full rounded-xl border border-border bg-surface-elevated py-2.5 pl-10 pr-4 text-sm focus-ring"
                  />
                </div>
                <ul className="popup-scroll max-h-40 space-y-1">
                  {visibleToAdd.length > 0 ? (
                    visibleToAdd.map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          disabled={addMemberMutation.isPending}
                          onClick={() => addMemberMutation.mutate(u.id)}
                          className="flex w-full min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-surface-elevated focus-ring"
                        >
                          <Avatar
                            src={u.avatarUrl}
                            firstName={u.firstName}
                            lastName={u.lastName}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{formatUserName(u)}</p>
                            <p className="truncate text-caption text-text-muted">
                              {getRoleLabel(u.role)}
                            </p>
                          </div>
                          <span className="text-sm text-brand">Добавить</span>
                        </button>
                      </li>
                    ))
                  ) : (
                    <li className="py-4 text-center text-body-sm text-text-muted">Ничего не найдено</li>
                  )}
                </ul>
              </div>
            )}
          </>
        )}

        <div className="space-y-2 border-t border-border-subtle pt-4">
          <Button
            variant="secondary"
            className="w-full justify-start"
            onClick={() => pinListMutation.mutate(!isListPinned)}
            loading={pinListMutation.isPending}
          >
            <Pin className="h-4 w-4" />
            {isListPinned ? 'Открепить из списка' : 'Закрепить в списке'}
          </Button>
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
