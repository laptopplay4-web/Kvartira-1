import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, MoreHorizontal, Users, Calendar } from 'lucide-react';
import type { Conversation, User } from '@/types';
import { getConversationDisplayTitle, isGroupLike } from '@/services/chat/helpers';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
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
  const otherId = conversation.participantIds.find((id) => id !== currentUserId);
  const other = users.find((u) => u.id === otherId);
  const memberCount = conversation.participantIds.length;

  return (
    <>
      <header className="sticky top-0 z-10 flex shrink-0 flex-col overflow-hidden border-b border-border-subtle bg-surface">
        <div className="flex h-14 items-center gap-3 px-3 md:px-4">
          {showBack && (
            <Button variant="ghost" size="icon" onClick={onBack} aria-label="Назад к списку чатов" className="md:hidden">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}

          {isGroup ? (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-muted text-accent">
              <Users className="h-4 w-4" aria-hidden />
            </div>
          ) : other ? (
            <Avatar firstName={other.firstName} lastName={other.lastName} size="sm" />
          ) : null}

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-h3">{title}</h1>
            {isGroup && (
              <p className="text-caption text-text-muted">
                {memberCount} {memberCount === 1 ? 'участник' : memberCount < 5 ? 'участника' : 'участников'}
              </p>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Настройки чата"
            onClick={() => setSettingsOpen(true)}
          >
            <MoreHorizontal className="h-5 w-5" />
          </Button>
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
