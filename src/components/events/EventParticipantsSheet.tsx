import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Minus, Users } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { IconButton } from '@/components/ui/IconButton';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { UserPreviewTrigger } from '@/components/users/UserPreviewTrigger';
import { markEventNotificationsRead } from '@/hooks/useMarkEventParticipationViewed';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { getUnreadParticipationParticipantIds } from '@/services/events/unread';
import { getRoleLabel } from '@/permissions';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { cn } from '@/utils';
import type { User } from '@/types';

interface EventParticipantsSheetProps {
  open: boolean;
  onClose: () => void;
  eventId: string;
  requesterId: string;
}

type RosterRow = {
  user: User;
  kind: 'active' | 'joined' | 'left';
};

export function EventParticipantsSheet({
  open,
  onClose,
  eventId,
  requesterId,
}: EventParticipantsSheetProps) {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const [removeTarget, setRemoveTarget] = useState<User | null>(null);
  const [closing, setClosing] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['event-participants-roster', eventId, requesterId],
    queryFn: async (): Promise<RosterRow[]> => {
      const [participants, notifs] = await Promise.all([
        api.events.getEventParticipants(eventId, requesterId),
        api.notifications.getNotifications(requesterId),
      ]);

      const joinedIds = new Set(
        getUnreadParticipationParticipantIds(notifs, eventId, 'join'),
      );
      const leftIds = getUnreadParticipationParticipantIds(notifs, eventId, 'leave');
      const activeIds = new Set(participants.map((p) => p.id));

      const rows: RosterRow[] = participants.map((user) => ({
        user,
        kind: joinedIds.has(user.id) ? 'joined' : 'active',
      }));

      const ghostIds = leftIds.filter((id) => !activeIds.has(id));
      const ghosts = await Promise.all(
        ghostIds.map(async (id) => {
          try {
            return await api.users.getUser(id, requesterId);
          } catch {
            return null;
          }
        }),
      );
      for (const user of ghosts) {
        if (user) rows.push({ user, kind: 'left' });
      }
      return rows;
    },
    enabled: open && !!eventId,
  });

  const removeMutation = useMutation({
    mutationFn: (participantId: string) =>
      api.events.removeEventParticipant(eventId, participantId, requesterId),
    onSuccess: () => {
      setRemoveTarget(null);
      void queryClient.invalidateQueries({ queryKey: ['event-participants', eventId] });
      void queryClient.invalidateQueries({ queryKey: ['event-participants-roster', eventId] });
      void queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const handleClose = () => {
    if (closing) return;
    setClosing(true);
    void markEventNotificationsRead(eventId, requesterId, queryClient)
      .catch(() => undefined)
      .finally(() => {
        setClosing(false);
        setRemoveTarget(null);
        void queryClient.invalidateQueries({
          queryKey: ['event-participants-roster', eventId],
        });
        onClose();
      });
  };

  return (
    <Sheet open={open} onClose={handleClose} title="Участники">
      {!isOnline && (
        <p className="mb-3 text-body-sm text-warning" role="status">
          {OFFLINE_NETWORK_MESSAGE}
        </p>
      )}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          message={
            error instanceof Error ? error.message : 'Не удалось загрузить участников'
          }
          onRetry={() => refetch()}
        />
      ) : data && data.length > 0 ? (
        <ul className="space-y-2">
          {data.map(({ user, kind }) => (
            <li
              key={`${kind}-${user.id}`}
              className={cn(
                'flex items-center gap-1 rounded-xl',
                kind === 'joined' && 'bg-success-muted ring-1 ring-success/25',
                kind === 'left' && 'bg-danger-muted ring-1 ring-danger/25',
              )}
            >
              <UserPreviewTrigger
                user={user}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 text-left hover:bg-surface-hover/60"
              >
                <Avatar
                  firstName={user.firstName}
                  lastName={user.lastName}
                  src={user.avatarUrl}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-medium">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-caption text-text-muted">
                    {kind === 'left' ? 'Отменил(а) участие' : getRoleLabel(user.role)}
                  </p>
                </div>
              </UserPreviewTrigger>
              {kind !== 'left' && (
                <IconButton
                  label={`Удалить ${user.firstName} ${user.lastName}`}
                  variant="destructive"
                  size="sm"
                  className="shrink-0"
                  disabled={!isOnline || removeMutation.isPending}
                  onClick={() => setRemoveTarget(user)}
                >
                  <Minus className="h-4 w-4" aria-hidden />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Users}
          title="Пока никого нет"
          description="Записи на участие появятся здесь"
          className="py-8"
        />
      )}

      <ConfirmDialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title="Удалить участника?"
        description={
          removeTarget ? (
            <>
              <p>
                {removeTarget.firstName} {removeTarget.lastName} будет удалён(а) из мероприятия,
                место освободится.
              </p>
              {removeMutation.error && (
                <p className="mt-2 text-danger" role="alert">
                  {removeMutation.error instanceof ApiError
                    ? removeMutation.error.message
                    : 'Не удалось удалить'}
                </p>
              )}
            </>
          ) : null
        }
        confirmLabel="Удалить"
        tone="destructive"
        loading={removeMutation.isPending}
        disabled={!isOnline}
        onConfirm={() => {
          if (removeTarget) removeMutation.mutate(removeTarget.id);
        }}
      />
    </Sheet>
  );
}
