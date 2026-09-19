import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays } from 'date-fns';

import { BackLink } from '@/components/ui/BackLink';
import { useCurrentUser } from '@/stores/authStore';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { canRescheduleLesson, canCancelLesson } from '@/services/lessons/access';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { ErrorState } from '@/components/ui/ErrorState';
import { LessonCardSkeleton } from '@/components/ui/Skeleton';
import { LessonVisitHero } from '@/components/lessons/LessonVisitHero';
import { LessonVisitActions } from '@/components/lessons/LessonVisitActions';
import { formatFullDate, formatLessonDateTime, formatTimeRange } from '@/utils/dates';
import { cn } from '@/utils';

export default function LessonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useCurrentUser()!;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();

  const [showReschedule, setShowReschedule] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState('');

  const { data: lesson, isLoading, error: loadError, refetch } = useQuery({
    queryKey: ['lesson', id],
    queryFn: () => api.lessons.getLesson(id!, user.id),
    enabled: !!id,
    retry: (_count, err) => !(err instanceof ApiError && err.status === 403),
  });

  const { data: directions } = useQuery({
    queryKey: ['directions'],
    queryFn: () => api.lessons.getDirections(),
  });
  const { data: teachers } = useQuery({
    queryKey: ['teachers'],
    queryFn: () => api.lessons.getTeachers(),
  });
  const { data: students } = useQuery({
    queryKey: ['students'],
    queryFn: () => api.users.getAllUsers(user.id),
    enabled: user.role !== 'student',
  });
  const { data: rescheduleSlots } = useQuery({
    queryKey: ['slots', lesson?.teacherId, newDate, id],
    queryFn: () =>
      api.lessons.getAvailableSlots({
        teacherId: lesson!.teacherId,
        date: newDate,
        excludeLessonId: id,
      }),
    enabled: showReschedule && !!lesson && !!newDate,
  });

  const invalidateLessonQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['lesson', id] });
    queryClient.invalidateQueries({ queryKey: ['lessons'] });
    queryClient.invalidateQueries({ queryKey: ['slots'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['lesson-history', id] });
  };

  const rescheduleMutation = useMutation({
    mutationFn: () => api.lessons.rescheduleLesson(id!, { date: newDate, startTime: newTime }, user.id),
    onSuccess: () => {
      invalidateLessonQueries();
      setShowReschedule(false);
      setError('');
    },
    onError: (e) => {
      setError(e instanceof ApiError ? e.message : 'Ошибка переноса');
      if (e instanceof ApiError && e.status === 409) {
        queryClient.invalidateQueries({ queryKey: ['slots', lesson?.teacherId, newDate, id] });
      }
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.lessons.cancelLesson(id!, user.id, cancelReason),
    onSuccess: () => {
      invalidateLessonQueries();
      setShowCancel(false);
      setError('');
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Ошибка отмены'),
  });

  if (isLoading) {
    return (
      <div className="page-container">
        <LessonCardSkeleton />
      </div>
    );
  }

  if (loadError instanceof ApiError && loadError.status === 403) {
    return (
      <div className="page-container">
        <ErrorState
          title="Нет доступа"
          message="Вы не можете просматривать это занятие"
          onRetry={() => navigate('/lessons')}
        />
      </div>
    );
  }

  if (loadError || !lesson) {
    return (
      <div className="page-container">
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  const teacher = teachers?.find((t) => t.id === lesson.teacherId);
  const student = students?.find((s) => s.id === lesson.studentId);
  const direction = directions?.find((d) => d.id === lesson.directionId);
  const canReschedule = canRescheduleLesson(user, lesson);
  const canCancel = canCancelLesson(user, lesson);
  const dateOptions = Array.from({ length: 14 }, (_, i) => format(addDays(new Date(), i + 1), 'yyyy-MM-dd'));

  return (
    <div className="page-container max-w-lg">
      <BackLink label="К занятиям" fallbackTo="/lessons" />

      <header className="mb-4">
        <h1 className="text-h1">{direction?.name ?? 'Занятие'}</h1>
        <p className="mt-1 text-body-sm text-text-secondary">Карточка записи</p>
      </header>

      <div className="mb-4">
        <LessonVisitHero
          directionName={direction?.name ?? ''}
          status={lesson.status}
          date={lesson.date}
          startTime={lesson.startTime}
          durationMinutes={lesson.durationMinutes}
          location={lesson.location}
          teacher={teacher}
          student={student}
          showStudent={user.role !== 'student'}
        />
      </div>

      <div className="mb-6">
        <LessonVisitActions
          canReschedule={canReschedule}
          canCancel={canCancel}
          isOnline={isOnline}
          onReschedule={() => {
            setShowReschedule(true);
            setNewDate(lesson.date);
            setError('');
          }}
          onCancel={() => {
            setShowCancel(true);
            setError('');
          }}
        />
      </div>

      <Modal
        open={showReschedule}
        onClose={() => setShowReschedule(false)}
        title="Перенести занятие"
        footer={
          <Button
            fullWidth
            disabled={!newDate || !newTime || !isOnline}
            loading={rescheduleMutation.isPending}
            onClick={() => rescheduleMutation.mutate()}
          >
            {rescheduleMutation.isPending ? 'Переносим...' : 'Перенести'}
          </Button>
        }
      >
        <div className="space-y-4">
          <Card padding="sm">
            <p className="text-caption">Текущее</p>
            <p className="text-body-sm tabular-nums">
              {formatTimeRange(lesson.startTime, lesson.durationMinutes)} · {formatFullDate(lesson.date)}
            </p>
          </Card>
          <div>
            <p className="text-label mb-2">Новая дата</p>
            <div className="popup-scroll grid max-h-40 grid-cols-2 gap-2">
              {dateOptions.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setNewDate(d);
                    setNewTime('');
                  }}
                  className={cn(
                    'min-h-11 rounded-lg border px-3 py-2 text-sm focus-ring',
                    newDate === d ? 'border-brand bg-brand-muted' : 'border-border-subtle',
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          {newDate ? (
            <div>
              <p className="text-label mb-2">Доступное время</p>
              {rescheduleSlots && rescheduleSlots.length === 0 ? (
                <p className="text-body-sm text-text-secondary">На эту дату нет свободных слотов.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {rescheduleSlots?.map((s) => (
                    <button
                      key={s.startTime}
                      type="button"
                      onClick={() => setNewTime(s.startTime)}
                      className={cn(
                        'min-h-11 rounded-lg border py-2 text-sm tabular-nums focus-ring',
                        newTime === s.startTime ? 'border-brand bg-brand-muted' : 'border-border-subtle',
                      )}
                    >
                      {s.startTime}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}
          {!isOnline && (
            <p className="text-sm text-danger" role="alert">
              {OFFLINE_NETWORK_MESSAGE}
            </p>
          )}
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
        </div>
      </Modal>

      <Modal
        open={showCancel}
        onClose={() => setShowCancel(false)}
        title="Отменить занятие?"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setShowCancel(false)}>
              Назад
            </Button>
            <Button
              variant="destructive"
              fullWidth
              disabled={!isOnline}
              loading={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate()}
            >
              {cancelMutation.isPending ? 'Отменяем...' : 'Отменить занятие'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-body-sm text-text-secondary">
            {formatLessonDateTime(lesson.date, lesson.startTime)} · {direction?.name}
          </p>
          <p className="text-body-sm text-text-secondary">
            После отмены слот станет доступен для другой записи.
          </p>
          <textarea
            className="w-full rounded-lg border border-border bg-surface-elevated p-3 text-sm focus-ring"
            placeholder="Причина отмены (необязательно)"
            rows={3}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          {!isOnline && (
            <p className="text-sm text-danger" role="alert">
              {OFFLINE_NETWORK_MESSAGE}
            </p>
          )}
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
