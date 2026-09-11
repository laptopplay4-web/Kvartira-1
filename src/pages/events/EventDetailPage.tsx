import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, MapPin, Music2, Pencil, Trash2, Users } from 'lucide-react';
import { BackLink } from '@/components/ui/BackLink';
import { useCurrentUser } from '@/stores/authStore';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { canManageEvents } from '@/services/events/access';
import { EVENT_TYPE_LABELS } from '@/services/events/constants';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { CompetitionApplicationModal } from '@/components/events/CompetitionApplicationModal';
import { EventFormModal } from '@/components/events/EventFormModal';
import { formatFullDate } from '@/utils/dates';
import type { CompetitionApplication, EventType } from '@/types';

const EVENT_CTA: Record<EventType, string> = {
  concert: 'Участвовать',
  masterclass: 'Записаться',
  competition: 'Подать заявку',
  invited: 'Принять приглашение',
};

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useCurrentUser()!;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const canManage = canManageEvents(user);
  const [applicationOpen, setApplicationOpen] = useState(false);
  const [applicationError, setApplicationError] = useState('');
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: event, isLoading, error, refetch } = useQuery({
    queryKey: ['event', id],
    queryFn: () => api.events.getEvent(id!, user.id),
    enabled: !!id,
  });

  const isRegistered = event?.registeredUserIds.includes(user.id) ?? false;
  const isCompetition = event?.type === 'competition';

  const { data: registration } = useQuery({
    queryKey: ['event-registration', id, user.id],
    queryFn: () => api.events.getRegistration(id!, user.id),
    enabled: !!id && isCompetition && isRegistered,
  });

  const registerMutation = useMutation({
    mutationFn: (application?: CompetitionApplication) =>
      api.events.register(id!, user.id, application),
    onSuccess: () => {
      setApplicationOpen(false);
      setApplicationError('');
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      queryClient.invalidateQueries({ queryKey: ['event-registration', id, user.id] });
      queryClient.invalidateQueries({ queryKey: ['events', user.id] });
    },
    onError: (err) => {
      setApplicationError(err instanceof ApiError ? err.message : 'Не удалось подать заявку');
    },
  });

  const unregisterMutation = useMutation({
    mutationFn: () => api.events.unregister(id!, user.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      queryClient.invalidateQueries({ queryKey: ['event-registration', id, user.id] });
      queryClient.invalidateQueries({ queryKey: ['events', user.id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.events.deleteEvent(id!, user.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      navigate('/events', { replace: true });
    },
  });

  if (isLoading) return <div className="page-container"><Skeleton className="h-64" /></div>;
  if (error || !event) return <div className="page-container"><ErrorState onRetry={() => refetch()} /></div>;

  const isFull = event.maxParticipants != null && event.registeredUserIds.length >= event.maxParticipants;

  function invalidateEvent() {
    void queryClient.invalidateQueries({ queryKey: ['event', id] });
    void queryClient.invalidateQueries({ queryKey: ['events'] });
  }

  const handleRegisterClick = () => {
    if (isCompetition) {
      setApplicationError('');
      setApplicationOpen(true);
      return;
    }
    registerMutation.mutate(undefined);
  };

  const handleApplicationSubmit = (application: CompetitionApplication) => {
    registerMutation.mutate(application);
  };

  return (
    <div className="page-container max-w-lg">
      <div className="mb-4 flex items-start justify-between gap-3">
        <BackLink label="К мероприятиям" fallbackTo="/events" className="mb-0" />
        {canManage && (
          <div className="flex shrink-0 gap-1">
            <Button
              variant="secondary"
              size="icon"
              className="min-h-11 min-w-11"
              aria-label="Редактировать"
              disabled={!isOnline}
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-5 w-5" aria-hidden />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="min-h-11 min-w-11 text-danger hover:text-danger"
              aria-label="Удалить"
              disabled={!isOnline || deleteMutation.isPending}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-5 w-5" aria-hidden />
            </Button>
          </div>
        )}
      </div>

      {event.imageUrl && (
        <img
          src={event.imageUrl}
          alt=""
          className="mb-4 aspect-[16/9] w-full rounded-xl object-cover"
        />
      )}

      <Badge variant="brand" className="mb-3">{EVENT_TYPE_LABELS[event.type]}</Badge>
      <h1 className="text-h1">{event.title}</h1>

      <Card className="mt-6 space-y-3">
        <p className="text-body text-text-secondary">{event.description}</p>
        <p className="flex items-center gap-2 text-body-sm">
          <Clock className="h-4 w-4 text-text-muted" aria-hidden />
          {formatFullDate(event.date)} · {event.startTime}
          {event.endTime && ` — ${event.endTime}`}
        </p>
        <p className="flex items-center gap-2 text-body-sm">
          <MapPin className="h-4 w-4 text-text-muted" aria-hidden />
          {event.location}
        </p>
        {event.maxParticipants && (
          <p className="flex items-center gap-2 text-body-sm">
            <Users className="h-4 w-4 text-text-muted" aria-hidden />
            {event.registeredUserIds.length} / {event.maxParticipants} мест
          </p>
        )}
      </Card>

      {isCompetition && isRegistered && registration?.application && (
        <Card className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-body-sm font-medium">
            <Music2 className="h-4 w-4 text-brand" aria-hidden />
            Ваша заявка
          </div>
          <p className="text-body-sm">
            <span className="text-text-muted">Произведение:</span>{' '}
            {registration.application.pieceTitle}
          </p>
          <p className="text-body-sm">
            <span className="text-text-muted">Композитор:</span>{' '}
            {registration.application.composer}
          </p>
          <p className="text-body-sm">
            <span className="text-text-muted">Продолжительность:</span>{' '}
            {registration.application.durationMinutes} мин
          </p>
          {registration.application.category && (
            <p className="text-body-sm">
              <span className="text-text-muted">Категория:</span>{' '}
              {registration.application.category}
            </p>
          )}
          {registration.application.notes && (
            <p className="text-body-sm text-text-secondary">{registration.application.notes}</p>
          )}
        </Card>
      )}

      <div className="mt-6">
        {!isOnline && (
          <p className="mb-4 text-sm text-danger" role="alert">
            {OFFLINE_NETWORK_MESSAGE}
          </p>
        )}
        {isRegistered ? (
          <Button
            variant="secondary"
            fullWidth
            disabled={!isOnline}
            loading={unregisterMutation.isPending}
            onClick={() => unregisterMutation.mutate()}
          >
            Отменить участие
          </Button>
        ) : (
          <Button
            fullWidth
            disabled={isFull || !isOnline}
            loading={registerMutation.isPending && !isCompetition}
            onClick={handleRegisterClick}
          >
            {isFull ? 'Мест нет' : EVENT_CTA[event.type]}
          </Button>
        )}
      </div>

      {isCompetition && (
        <CompetitionApplicationModal
          open={applicationOpen}
          onClose={() => {
            setApplicationOpen(false);
            setApplicationError('');
          }}
          onSubmit={handleApplicationSubmit}
          loading={registerMutation.isPending}
          error={applicationError}
          disabled={!isOnline}
        />
      )}

      {canManage && (
        <EventFormModal
          open={editing}
          onClose={() => setEditing(false)}
          adminId={user.id}
          event={event}
          onSaved={invalidateEvent}
        />
      )}

      {canManage && (
        <ConfirmDialog
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          title="Удалить мероприятие?"
          description={
            <>
              <p>«{event.title}» будет удалено без возможности восстановления.</p>
              {deleteMutation.error && (
                <p className="mt-2 text-danger" role="alert">
                  {deleteMutation.error instanceof ApiError
                    ? deleteMutation.error.message
                    : 'Не удалось удалить'}
                </p>
              )}
            </>
          }
          confirmLabel="Удалить"
          tone="destructive"
          loading={deleteMutation.isPending}
          disabled={!isOnline}
          onConfirm={() => deleteMutation.mutate()}
        />
      )}
    </div>
  );
}
