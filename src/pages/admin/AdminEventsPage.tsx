import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CalendarDays, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '@/services/api';
import { EVENT_TYPE_LABELS } from '@/services/events/constants';
import { useCurrentUser } from '@/stores/authStore';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { AdminPageHeader } from '@/components/ui/AdminPageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { EventFormModal } from '@/components/events/EventFormModal';
import type { SchoolEvent } from '@/types';

export default function AdminEventsPage() {
  const user = useCurrentUser()!;
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const [editingEvent, setEditingEvent] = useState<SchoolEvent | undefined>();
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SchoolEvent | undefined>();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['events', 'admin', user.id],
    queryFn: () => api.events.getAllEvents(user.id),
  });

  const deleteMutation = useMutation({
    mutationFn: (eventId: string) => api.events.deleteEvent(eventId, user.id),
    onSuccess: () => {
      setDeleteTarget(undefined);
      void queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });

  function invalidateEvents() {
    void queryClient.invalidateQueries({ queryKey: ['events'] });
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
      <AdminPageHeader title="Мероприятия" />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-body-sm text-text-secondary">
          Создание и редактирование мероприятий школы.
        </p>
        <Button
          className="min-h-11"
          disabled={!isOnline}
          onClick={() => setCreating(true)}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Добавить
        </Button>
      </div>

      {!isOnline && (
        <p className="mb-4 text-body-sm text-warning" role="status">
          {OFFLINE_NETWORK_MESSAGE}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : data?.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Мероприятий пока нет"
          description="Создайте первое мероприятие для учеников и гостей."
          action={
            <Button disabled={!isOnline} onClick={() => setCreating(true)}>
              Добавить мероприятие
            </Button>
          }
          className="py-8"
        />
      ) : (
        <div className="space-y-3">
          {data?.map((event) => (
            <Card key={event.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{event.title}</p>
                    <Badge variant="default">{EVENT_TYPE_LABELS[event.type]}</Badge>
                  </div>
                  <p className="mt-1 text-caption text-text-muted">
                    {format(new Date(event.date), 'dd.MM.yyyy')} · {event.startTime}
                    {event.endTime ? `–${event.endTime}` : ''} · {event.location}
                  </p>
                  <p className="mt-2 line-clamp-2 text-body-sm text-text-secondary">
                    {event.description}
                  </p>
                  <p className="mt-1 text-caption text-text-muted">
                    Записано: {event.registeredUserIds.length}
                    {event.maxParticipants != null ? ` / ${event.maxParticipants}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Link
                    to={`/events/${event.id}`}
                    aria-label="Открыть карточку"
                    className="rounded-lg p-2 text-text-muted hover:text-brand focus-ring min-h-11 min-w-11"
                  >
                    <ExternalLink className="h-5 w-5" />
                  </Link>
                  <button
                    type="button"
                    aria-label="Редактировать"
                    className="rounded-lg p-2 text-text-muted hover:text-brand focus-ring min-h-11 min-w-11"
                    onClick={() => setEditingEvent(event)}
                  >
                    <Pencil className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Удалить"
                    disabled={!isOnline || deleteMutation.isPending}
                    className="rounded-lg p-2 text-text-muted hover:text-danger focus-ring min-h-11 min-w-11 disabled:opacity-50"
                    onClick={() => setDeleteTarget(event)}
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <EventFormModal
        open={creating}
        onClose={() => setCreating(false)}
        adminId={user.id}
        onSaved={invalidateEvents}
      />

      <EventFormModal
        open={!!editingEvent}
        onClose={() => setEditingEvent(undefined)}
        adminId={user.id}
        event={editingEvent}
        onSaved={invalidateEvents}
      />

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-event-title"
        >
          <Card className="w-full max-w-sm p-5">
            <h2 id="delete-event-title" className="text-h3">
              Удалить мероприятие?
            </h2>
            <p className="mt-2 text-body-sm text-text-secondary">
              «{deleteTarget.title}» будет удалено без возможности восстановления.
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" className="flex-1 min-h-11" onClick={() => setDeleteTarget(undefined)}>
                Отмена
              </Button>
              <Button
                variant="destructive"
                className="flex-1 min-h-11"
                loading={deleteMutation.isPending}
                disabled={!isOnline}
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
              >
                Удалить
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
