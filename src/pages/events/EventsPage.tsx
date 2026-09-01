import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, MapPin, Clock } from 'lucide-react';
import { useCurrentUser } from '@/stores/authStore';
import { api } from '@/services/api';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatFullDate } from '@/utils/dates';
import { EVENT_TYPE_LABELS } from '@/services/events/constants';

export default function EventsPage() {
  const user = useCurrentUser()!;

  const { data: events, isLoading, error, refetch } = useQuery({
    queryKey: ['events', user.id],
    queryFn: () => api.events.getEvents(user.id),
  });

  if (error) return <div className="page-container"><ErrorState onRetry={() => refetch()} /></div>;

  return (
    <div className="page-container">
      <h1 className="text-h1 mb-6">Мероприятия</h1>

      {isLoading ? (
        <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : events && events.length > 0 ? (
        <div className="space-y-4">
          {events.map((event) => (
            <Link key={event.id} to={`/events/${event.id}`}>
              <Card interactive>
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
                      <div>
                        <Badge variant="brand">{EVENT_TYPE_LABELS[event.type]}</Badge>
                        <h2 className="mt-2 text-h2">{event.title}</h2>
                        <p className="mt-2 line-clamp-2 text-body-sm text-text-secondary">{event.description}</p>
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
                      {event.registeredUserIds.includes(user.id) && (
                        <Badge variant="success">Записан</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState icon={Sparkles} title="Нет мероприятий" description="Следите за анонсами школы" />
      )}
    </div>
  );
}
