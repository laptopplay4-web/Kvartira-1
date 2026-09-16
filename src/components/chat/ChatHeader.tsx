import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, MoreHorizontal, Users, Calendar } from 'lucide-react';
import type { Conversation, User } from '@/types';
import { getConversationDisplayTitle, isGroupLike } from '@/services/chat/helpers';
import { isSchoolWideConversation } from '@/services/chat/schoolWide';
import { Avatar } from '@/components/ui/Avatar';
import { backNavIconButtonClassName } from '@/components/ui/BackLink';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/utils';
import { isDisplayableAvatarSrc } from '@/services/profile/constants';
import { UserPreviewTrigger } from '@/components/users/UserPreviewTrigger';
import { useConversationMembers } from '@/hooks/useConversationMembers';
import { ConversationSettings } from './ConversationSettings';
import { api } from '@/services/api';
import { formatLessonDateTime } from '@/utils/dates';

interface ChatHeaderProps {
  conversation?: Conversation;
  currentUserId: string;
  currentUser: User;
  users: User[];
  showBack?: boolean;
  onBack?: () => void;
}

function formatMemberCountLabel(count: number): string {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return `${count} участников`;
  if (mod10 === 1) return `${count} участник`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} участника`;
  return `${count} участников`;
}

export function ChatHeader({
  conversation,
  currentUserId,
  currentUser,
  users,
  showBack,
  onBack,
}: ChatHeaderProps) {
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const lessonId = conversation?.metadata?.lessonId;

  const { data: members } = useConversationMembers(
    conversation && isGroupLike(conversation) ? conversation.id : undefined,
    currentUserId,
  );

  const { data: lesson } = useQuery({
    queryKey: ['lesson', lessonId, currentUserId],
    queryFn: () => api.lessons.getLesson(lessonId!, currentUserId),
    enabled: !!lessonId && !!conversation,
    retry: false,
  });

  if (!conversation) {
    return (
      <header className="flex h-14 shrink-0 items-center border-b border-border-subtle px-4">
        <p className="text-text-muted">Выберите чат</p>
      </header>
    );
  }

  const title = getConversationDisplayTitle(conversation, currentUserId, users);
  const isGroup = isGroupLike(conversation);
  const schoolWide = isSchoolWideConversation(conversation);
  const otherId = conversation.participantIds.find((id) => id !== currentUserId);
  const other = users.find((u) => u.id === otherId);
  const memberCount = members?.length ?? new Set(conversation.participantIds).size;
  const memberLabel = schoolWide ? 'Все пользователи школы' : formatMemberCountLabel(memberCount);

  return (
    <>
      <header className="sticky top-0 z-10 flex shrink-0 flex-col overflow-hidden border-b border-border-subtle bg-surface">
        <div className="flex h-14 items-center gap-3 px-3 md:px-4">
          {showBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Назад к списку чатов"
              className={cn(backNavIconButtonClassName, 'md:hidden')}
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
          )}

          {isGroup ? (
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Настройки чата"
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left focus-ring"
            >
              {conversation.avatarUrl && isDisplayableAvatarSrc(conversation.avatarUrl) ? (
                <img
                  src={conversation.avatarUrl}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-muted text-accent">
                  <Users className="h-4 w-4" aria-hidden />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-h3">{title}</h1>
                <p className="text-caption text-text-muted">{memberLabel}</p>
              </div>
            </button>
          ) : other ? (
            <UserPreviewTrigger
              user={other}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-0"
            >
              <Avatar
                src={other.avatarUrl}
                firstName={other.firstName}
                lastName={other.lastName}
                size="sm"
              />
              <div className="min-w-0 flex-1 text-left">
                <h1 className="truncate text-h3">{title}</h1>
              </div>
            </UserPreviewTrigger>
          ) : (
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-h3">{title}</h1>
            </div>
          )}

          {!isGroup && (
            <IconButton label="Настройки чата" onClick={() => setSettingsOpen(true)}>
              <MoreHorizontal className="h-5 w-5" aria-hidden />
            </IconButton>
          )}
        </div>

        {lesson && (
          <button
            type="button"
            onClick={() => navigate(`/lessons/${lesson.id}`)}
            className="flex items-center gap-2 border-t border-border-subtle px-4 py-2 text-left hover:bg-surface-elevated focus-ring min-h-[44px]"
          >
            <Calendar className="h-4 w-4 shrink-0 text-brand" aria-hidden />
            <div className="min-w-0">
              <p className="text-caption font-medium text-brand">Занятие</p>
              <p className="truncate text-caption text-text-muted">
                {formatLessonDateTime(lesson.date, lesson.startTime)}
              </p>
            </div>
          </button>
        )}
      </header>

      <ConversationSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        conversation={conversation}
        currentUser={currentUser}
        users={users}
        onLeft={onBack}
        onDeleted={onBack}
      />
    </>
  );
}
