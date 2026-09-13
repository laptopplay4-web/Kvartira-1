import { useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Archive, Clock, MapPin } from 'lucide-react';
import { BackLink } from '@/components/ui/BackLink';
import { useCurrentUser } from '@/stores/authStore';
import { api } from '@/services/api';
import { canManageEvents } from '@/services/events/access';
import { filterArchivedEvents, sortArchivedEventsDesc } from '@/services/events/helpers';
import { EVENT_TYPE_LABELS } from '@/services/events/constants';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatFullDate } from '@/utils/dates';

export default function EventsArchivePage() {
  const user = useCurrentUser()!;
  const canManage = canManageEvents(user);

  const { data: events, isLoading, error, refetch } = useQuery({
    queryKey: ['events', user.id],
    queryFn: () => api.events.getEvents(user.id),
    enabled: canManage,
  });

  const archived = useMemo(
    () => (events ? sortArchivedEventsDesc(filterArchivedEvents(events)) : []),
    [events],
  );

  if (!canManage) {
    return <Navigate to="/events" replace />;
  }

  if (error) {
    return (
      <div className="page-container">
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="page-container">
      <BackLink label="Мероприятия" fallbackTo="/events" />
      <header className="mb-6">
        <h1 className="text-h1">Архив мероприятий</h1>
      </header>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : archived.length > 0 ? (
        <div className="space-y-4">
          {archived.map((event) => (
            <Link key={event.id} to={`/events/${event.id}`}>
              <Card interactive>
                <div className="flex items-start gap-3">
                  {event.imageUrl && (
                    <img
                      src={event.imageUrl}
                      alt=""
                      className="h-20 w-20 shrink-0 rounded-lg object-cover opacity-90"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <Badge variant="default">{EVENT_TYPE_LABELS[event.type]}</Badge>
                    <h2 className="mt-2 text-h2">{event.title}</h2>
                    <p className="mt-2 line-clamp-2 text-body-sm text-text-secondary">
                      {event.description}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3 text-caption text-text-muted">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                        {formatFullDate(event.date)} · {event.startTime}
                        {event.endTime ? `–${event.endTime}` : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" aria-hidden />
                        {event.location}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Archive}
          title="Архив пуст"
          description="Прошедшие мероприятия появятся здесь"
          className="py-8"
        />
      )}
    </div>
  );
}
