import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Plus, Sparkles, MapPin, Clock, Users } from 'lucide-react';
import { useCurrentUser } from '@/stores/authStore';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { api } from '@/services/api';
import { canManageEvents } from '@/services/events/access';
import {
  filterActiveEvents,
  sortEventsByStartAsc,
} from '@/services/events/helpers';
import {
  countUnreadForEvent,
  markEventsTabSeen,
  shouldHighlightEventCard,
  summarizeUnreadParticipationDelta,
} from '@/services/events/unread';
import { isUserRegisteredForEvent } from '@/services/events/registration';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { EventFormModal } from '@/components/events/EventFormModal';
import { EventParticipationDeltaBadges } from '@/components/events/EventParticipationDeltaBadges';
import { formatFullDate } from '@/utils/dates';
import { EVENT_TYPE_LABELS } from '@/services/events/constants';
import { cn } from '@/utils';

export default function EventsPage() {
  const user = useCurrentUser()!;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const canManage = canManageEvents(user);
  const [creating, setCreating] = useState(false);

  const { data: events, isLoading, error, refetch } = useQuery({
    queryKey: ['events', user.id],
    queryFn: () => api.events.getEvents(user.id),
  });

  const activeEvents = useMemo(
    () => (events ? sortEventsByStartAsc(filterActiveEvents(events)) : []),
    [events],
  );

  const { data: notifications } = useQuery({
    queryKey: ['notifications', user.id],
    queryFn: () => api.notifications.getNotifications(user.id),
  });

  useEffect(() => {
    if (!canManage) return;
    markEventsTabSeen(user.id);
    void queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
  }, [canManage, user.id, queryClient]);

  function invalidateEvents() {
    void queryClient.invalidateQueries({ queryKey: ['events'] });
  }

  if (error) return <div className="page-container"><ErrorState onRetry={() => refetch()} /></div>;

  return (
    <div className="page-container">
      <header className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-h1">Мероприятия</h1>
        {canManage && (
          <div className="flex shrink-0 items-center gap-2">
            <IconButton
              label="Архив мероприятий"
              variant="tonal"
              className="shrink-0"
              onClick={() => navigate('/events/archive')}
            >
              <Archive className="h-5 w-5" aria-hidden />
            </IconButton>
            <IconButton
              label="Добавить мероприятие"
              variant="tonal"
              className="shrink-0"
              disabled={!isOnline}
              onClick={() => setCreating(true)}
            >
              <Plus className="h-5 w-5" aria-hidden />
            </IconButton>
          </div>
        )}
      </header>

      {canManage && !isOnline && (
        <p className="mb-4 text-body-sm text-warning" role="status">
          {OFFLINE_NETWORK_MESSAGE}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : activeEvents.length > 0 ? (
        <div className="space-y-4">
          {activeEvents.map((event) => {
            const staffDelta = notifications
              ? summarizeUnreadParticipationDelta(notifications, event.id)
              : { joins: 0, leaves: 0 };
            const studentUnread = notifications
              ? countUnreadForEvent(notifications, event.id)
              : 0;
            const highlight =
              canManage && notifications
                ? shouldHighlightEventCard(notifications, user.id, event.id)
                : !canManage && studentUnread > 0;
            const registered = isUserRegisteredForEvent(event, user.id);

            return (
              <Link key={event.id} to={`/events/${event.id}`}>
                <Card
                  interactive
                  className={cn(
                    highlight &&
                      'border-brand/30 bg-brand-muted/30 shadow-[inset_3px_0_0_0_var(--color-brand)]',
                  )}
                >
                  <div className="flex items-start gap-3">
                    {event.imageUrl && (
                      <img
                        src={event.imageUrl}
                        alt=""
                        className="h-20 w-20 shrink-0 rounded-lg object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Badge variant="brand">{EVENT_TYPE_LABELS[event.type]}</Badge>
                          <h2 className={cn('mt-2 text-h2', highlight && 'text-text-primary')}>
                            {event.title}
                          </h2>
                          <p className="mt-2 line-clamp-2 text-body-sm text-text-secondary">
                            {event.description}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-3 text-caption text-text-muted">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" aria-hidden />
                              {formatFullDate(event.date)} · {event.startTime}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" aria-hidden />
                              {event.location}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2 overflow-visible pr-1 pt-1">
                          {canManage && (staffDelta.joins > 0 || staffDelta.leaves > 0) && (
                            <span className="inline-flex items-start gap-1.5 text-brand">
                              <Users className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                              <EventParticipationDeltaBadges
                                joins={staffDelta.joins}
                                leaves={staffDelta.leaves}
                                layout="inline"
                              />
                            </span>
                          )}
                          {!canManage && studentUnread > 0 && (
                            <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-brand-contrast">
                              +{studentUnread > 99 ? '99' : studentUnread}
                            </span>
                          )}
                          {registered && <Badge variant="success">Записан</Badge>}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Sparkles}
          title="Нет мероприятий"
          description="Следите за анонсами школы"
          action={
            canManage ? (
              <Button disabled={!isOnline} onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" aria-hidden />
                Добавить мероприятие
              </Button>
            ) : undefined
          }
        />
      )}

      {canManage && (
        <EventFormModal
          open={creating}
          onClose={() => setCreating(false)}
          adminId={user.id}
          onSaved={invalidateEvents}
        />
      )}
    </div>
  );
}
