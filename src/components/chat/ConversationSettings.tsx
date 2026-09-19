import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ChatAvatarEditor } from '@/components/chat/ChatAvatarEditor';
import { AddGroupMembersModal } from '@/components/assignments/AddGroupMembersModal';
import { api } from '@/services/api';
import type { Conversation, ConversationMember, Message, User } from '@/types';
import { cn, formatUserName } from '@/utils';
import { getRoleBadgeVariant, getRoleLabel } from '@/permissions';
import { filterUsersBySearchQuery, sortUsersByRoleAndName } from '@/services/users/helpers';
import {
  canDeleteConversation,
  canLeaveConversation,
  canManageMembers,
  canRemoveMember,
  canUpdateConversation,
  isMemberMuted,
} from '@/services/chat/access';
import { isSchoolWideConversation } from '@/services/chat/schoolWide';
import { sortConversationsWithPins } from '@/services/chat/helpers';
import {
  appendMessagesInInfiniteCache,
  type MessagesInfiniteData,
} from '@/services/chat/messageCache';
import { useConversationMembers } from '@/hooks/useConversationMembers';
import { useDeleteConversation } from '@/hooks/useDeleteConversation';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import {
  Bell,
  BellOff,
  GraduationCap,
  LogOut,
  Pin,
  Search,
  Trash2,
  UserPlus,
  Users,
  UsersRound,
} from 'lucide-react';
import { UserPreviewTrigger } from '@/components/users/UserPreviewTrigger';

type MemberRoleFilter = 'student' | 'teacher';
type MemberListFilter = 'all' | MemberRoleFilter;

/** Idle = soft tint; active = stronger fill + ring. */
const MEMBER_FILTER_IDLE: Record<MemberListFilter, string> = {
  all: 'bg-surface-elevated text-text-muted/80 border-border',
  student: 'bg-info-muted/45 text-info/80 border-info/25',
  teacher: 'bg-brand-muted/45 text-brand/80 border-brand/25',
};

const MEMBER_FILTER_ACTIVE: Record<MemberListFilter, string> = {
  all: 'bg-surface-elevated text-text-primary border-border ring-2 ring-text-muted/35',
  student: 'bg-info-muted text-info border-info/50 ring-2 ring-info/35',
  teacher: 'bg-brand-muted text-brand border-brand/50 ring-2 ring-brand/35',
};

const MEMBER_FILTER_OPTIONS = [
  { id: 'all' as const, role: null, label: 'Все', Icon: UsersRound },
  { id: 'student' as const, role: 'student' as const, label: 'Ученики', Icon: Users },
  { id: 'teacher' as const, role: 'teacher' as const, label: 'Преподаватели', Icon: GraduationCap },
] as const;

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
  const isOnline = useOnlineStatus();
  const { data: members } = useConversationMembers(conversation.id, currentUser.id);
  const [title, setTitle] = useState(conversation.title);
  const [avatarUrl, setAvatarUrl] = useState(conversation.avatarUrl ?? '');
  const [avatarError, setAvatarError] = useState('');
  const [memberQuery, setMemberQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<MemberRoleFilter | null>(null);
  const [addMembersOpen, setAddMembersOpen] = useState(false);

  const { data: directions = [] } = useQuery({
    queryKey: ['directions'],
    queryFn: () => api.lessons.getDirections(),
    enabled: open && conversation.type !== 'personal',
  });

  useEffect(() => {
    if (!open) {
      setAddMembersOpen(false);
      return;
    }
    setTitle(conversation.title);
    setAvatarUrl(conversation.avatarUrl ?? '');
    setAvatarError('');
    setMemberQuery('');
    setRoleFilter(null);
    setAddMembersOpen(false);
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

  const addMembersMutation = useMutation({
    mutationFn: (studentIds: string[]) =>
      api.chat.addMembers(conversation.id, currentUser.id, studentIds),
    onMutate: async (studentIds) => {
      const membersKey = ['members', conversation.id, currentUser.id] as const;
      const conversationKey = ['conversation', conversation.id] as const;
      const messagesKey = ['messages', conversation.id, currentUser.id] as const;
      await queryClient.cancelQueries({ queryKey: membersKey });
      await queryClient.cancelQueries({ queryKey: conversationKey });
      void queryClient.cancelQueries({ queryKey: messagesKey });

      const prevMembers = queryClient.getQueryData<ConversationMember[]>(membersKey);
      const prevConversation = queryClient.getQueryData<Conversation>(conversationKey);
      const prevMessages = queryClient.getQueryData<MessagesInfiniteData>(messagesKey);
      const now = new Date().toISOString();
      const existing = new Set((prevMembers ?? []).map((m) => m.userId));
      const toAdd = studentIds.filter((id) => !existing.has(id));
      const optimistic: ConversationMember[] = toAdd.map((userId) => ({
        conversationId: conversation.id,
        userId,
        role: 'member' as const,
        joinedAt: now,
        muted: false,
      }));

      if (optimistic.length > 0) {
        queryClient.setQueryData<ConversationMember[]>(membersKey, [
          ...(prevMembers ?? []),
          ...optimistic,
        ]);
        queryClient.setQueryData<Conversation>(conversationKey, (prev) => {
          const base = prev ?? conversation;
          return {
            ...base,
            participantIds: [...new Set([...base.participantIds, ...studentIds])],
          };
        });

        const actorName = formatUserName(currentUser);
        const systemMessages: Message[] = toAdd.map((targetId, index) => {
          const target = users.find((u) => u.id === targetId);
          const targetName = target ? formatUserName(target) : 'участника';
          return {
            id: `optimistic-add-${conversation.id}-${targetId}-${now}-${index}`,
            conversationId: conversation.id,
            senderId: currentUser.id,
            text: `${actorName} добавил ${targetName}`,
            createdAt: now,
            status: 'sent' as const,
            readBy: [currentUser.id],
            messageType: 'system' as const,
            metadata: {
              system: {
                event: 'member_added' as const,
                actorId: currentUser.id,
                targetUserId: targetId,
              },
            },
            clientMutationId: `optimistic-add-${targetId}`,
          };
        });
        queryClient.setQueryData<MessagesInfiniteData>(messagesKey, (old) =>
          appendMessagesInInfiniteCache(old, systemMessages),
        );
      }

      setAddMembersOpen(false);
      return { prevMembers, prevConversation, prevMessages };
    },
    onError: (_err, _ids, ctx) => {
      if (ctx?.prevMembers) {
        queryClient.setQueryData(['members', conversation.id, currentUser.id], ctx.prevMembers);
      }
      if (ctx?.prevConversation) {
        queryClient.setQueryData(['conversation', conversation.id], ctx.prevConversation);
      }
      if (ctx?.prevMessages) {
        queryClient.setQueryData(
          ['messages', conversation.id, currentUser.id],
          ctx.prevMessages,
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['members', conversation.id, currentUser.id] });
      void queryClient.invalidateQueries({ queryKey: ['conversation', conversation.id] });
      void queryClient.invalidateQueries({ queryKey: ['conversations', currentUser.id] });
      // Messages arrive via optimistic + realtime message.created — no full refetch.
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (targetUserId: string) =>
      api.chat.removeMember(conversation.id, currentUser.id, targetUserId),
    onMutate: async (targetUserId) => {
      const membersKey = ['members', conversation.id, currentUser.id] as const;
      const conversationKey = ['conversation', conversation.id] as const;
      const messagesKey = ['messages', conversation.id, currentUser.id] as const;
      await queryClient.cancelQueries({ queryKey: membersKey });
      await queryClient.cancelQueries({ queryKey: conversationKey });
      void queryClient.cancelQueries({ queryKey: messagesKey });

      const prevMembers = queryClient.getQueryData<ConversationMember[]>(membersKey);
      const prevConversation = queryClient.getQueryData<Conversation>(conversationKey);
      const prevMessages = queryClient.getQueryData<MessagesInfiniteData>(messagesKey);
      const target = users.find((u) => u.id === targetUserId);
      const now = new Date().toISOString();

      queryClient.setQueryData<ConversationMember[]>(membersKey, (prev) =>
        (prev ?? []).filter((m) => m.userId !== targetUserId),
      );
      queryClient.setQueryData<Conversation>(conversationKey, (prev) => {
        const base = prev ?? conversation;
        return {
          ...base,
          participantIds: base.participantIds.filter((id) => id !== targetUserId),
        };
      });

      const removeMsg: Message = {
        id: `optimistic-remove-${conversation.id}-${targetUserId}-${now}`,
        conversationId: conversation.id,
        senderId: currentUser.id,
        text: `${formatUserName(currentUser)} удалил ${target ? formatUserName(target) : 'участника'}`,
        createdAt: now,
        status: 'sent',
        readBy: [currentUser.id],
        messageType: 'system',
        metadata: {
          system: {
            event: 'member_removed',
            actorId: currentUser.id,
            targetUserId,
          },
        },
        clientMutationId: `optimistic-remove-${targetUserId}`,
      };
      queryClient.setQueryData<MessagesInfiniteData>(messagesKey, (old) =>
        appendMessagesInInfiniteCache(old, [removeMsg]),
      );

      return { prevMembers, prevConversation, prevMessages };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prevMembers) {
        queryClient.setQueryData(['members', conversation.id, currentUser.id], ctx.prevMembers);
      }
      if (ctx?.prevConversation) {
        queryClient.setQueryData(['conversation', conversation.id], ctx.prevConversation);
      }
      if (ctx?.prevMessages) {
        queryClient.setQueryData(
          ['messages', conversation.id, currentUser.id],
          ctx.prevMessages,
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['members', conversation.id, currentUser.id] });
      void queryClient.invalidateQueries({ queryKey: ['conversation', conversation.id] });
      // Messages via optimistic + realtime — no messages refetch.
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

  const deleteMutation = useDeleteConversation(currentUser.id);

  const memberUsers = useMemo(() => {
    const rows: { member: ConversationMember; user: User }[] = [];
    for (const member of members ?? []) {
      const user = users.find((u) => u.id === member.userId);
      if (user) rows.push({ member, user });
    }
    const sortedUsers = sortUsersByRoleAndName(rows.map((r) => r.user));
    const byId = new Map(rows.map((r) => [r.user.id, r]));
    return sortedUsers.map((u) => byId.get(u.id)!).filter(Boolean);
  }, [members, users]);

  const visibleMembers = useMemo(() => {
    const byRole = roleFilter
      ? memberUsers.filter((x) => x.user.role === roleFilter)
      : memberUsers;
    const matched = new Set(
      filterUsersBySearchQuery(
        byRole.map((x) => x.user),
        memberQuery,
      ).map((u) => u.id),
    );
    return byRole.filter((x) => matched.has(x.user.id));
  }, [memberUsers, memberQuery, roleFilter]);

  function selectMemberFilter(role: MemberRoleFilter | null) {
    setRoleFilter(role);
  }

  const memberIds = useMemo(() => {
    if (members?.length) return new Set(members.map((m) => m.userId));
    return new Set(conversation.participantIds);
  }, [members, conversation.participantIds]);

  const availableStudents = useMemo(
    () =>
      users.filter(
        (u) => u.role === 'student' && u.id !== currentUser.id && !memberIds.has(u.id),
      ),
    [users, currentUser.id, memberIds],
  );

  return (
    <>
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
              <p className="mb-2 text-sm font-medium">
                Участники ({visibleMembers.length}
                {roleFilter || memberQuery.trim() ? ` из ${memberUsers.length}` : ''}
                )
              </p>
              {memberUsers.length > 0 && (
                <>
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
                  <div className="mb-2 flex gap-2" role="group" aria-label="Фильтр по роли">
                    {MEMBER_FILTER_OPTIONS.map(({ id, role, label, Icon }) => {
                      const active = roleFilter === role;
                      return (
                        <button
                          key={id}
                          type="button"
                          aria-pressed={active}
                          aria-label={label}
                          title={label}
                          onClick={() => selectMemberFilter(role)}
                          className={cn(
                            'inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border transition-[color,background-color,box-shadow] focus-ring',
                            active ? MEMBER_FILTER_ACTIVE[id] : MEMBER_FILTER_IDLE[id],
                          )}
                        >
                          <Icon className="h-5 w-5" aria-hidden />
                        </button>
                      );
                    })}
                  </div>
                </>
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
                          <Badge
                            variant={getRoleBadgeVariant(user.role)}
                            className="mt-0.5 border border-current/25 font-normal"
                          >
                            {getRoleLabel(user.role)}
                          </Badge>
                        </div>
                      </UserPreviewTrigger>
                      {canManage &&
                        members &&
                        canRemoveMember(
                          currentUser,
                          conversation.id,
                          member.userId,
                          members,
                          conversation,
                          user,
                        ) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMemberMutation.mutate(member.userId)}
                          disabled={
                            !isOnline ||
                            (removeMemberMutation.isPending &&
                              removeMemberMutation.variables === member.userId)
                          }
                        >
                          Удалить
                        </Button>
                      )}
                    </li>
                  ))
                ) : (
                  <li className="py-4 text-center text-body-sm text-text-muted">
                    {memberQuery.trim() || roleFilter ? 'Ничего не найдено' : 'Нет участников'}
                  </li>
                )}
              </ul>
            </div>

            {canManage && (
              <Button
                type="button"
                variant="secondary"
                className="w-full justify-start"
                disabled={!isOnline || availableStudents.length === 0 || addMembersMutation.isPending}
                onClick={() => setAddMembersOpen(true)}
              >
                <UserPlus className="h-4 w-4" />
                {availableStudents.length === 0
                  ? 'Все ученики уже в чате'
                  : 'Добавить участников'}
              </Button>
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
              onClick={() => {
                onClose();
                onDeleted?.();
                deleteMutation.mutate(conversation.id);
              }}
              loading={
                deleteMutation.isPending && deleteMutation.variables === conversation.id
              }
            >
              <Trash2 className="h-4 w-4" />
              Удалить чат
            </Button>
          )}
        </div>
      </div>
    </Modal>

    <AddGroupMembersModal
      open={addMembersOpen}
      onClose={() => setAddMembersOpen(false)}
      students={availableStudents}
      directions={directions}
      loading={addMembersMutation.isPending}
      disabled={!isOnline}
      onAdd={async (studentIds) => {
        addMembersMutation.mutate(studentIds);
      }}
    />
    </>
  );
}
