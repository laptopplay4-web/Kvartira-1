import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ChevronLeft, Check } from 'lucide-react';

import { backNavButtonClassName } from '@/components/ui/BackLink';
import { useBackNavigation } from '@/hooks/useBackNavigation';
import { useCurrentUser } from '@/stores/authStore';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { SelectableTile } from '@/components/ui/SelectableTile';
import { UserPreviewTrigger } from '@/components/users/UserPreviewTrigger';
import { cn, formatUserName } from '@/utils';
import { formatFullDate, formatTimeRange, formatWeekday } from '@/utils/dates';

type Step = 'direction' | 'teacher' | 'date' | 'slot' | 'confirm' | 'success';

const STEPS: Step[] = ['direction', 'teacher', 'date', 'slot', 'confirm'];

export default function BookLessonPage() {
  const user = useCurrentUser()!;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const goBackToLessons = useBackNavigation('/lessons');

  const [step, setStep] = useState<Step>('direction');
  const [directionId, setDirectionId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [date, setDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('');
  const [bookedLessonId, setBookedLessonId] = useState('');
  const [error, setError] = useState('');

  const { data: directions, isLoading: dirLoading } = useQuery({
    queryKey: ['directions'],
    queryFn: () => api.lessons.getDirections(),
  });

  const { data: teachers, isLoading: teachersLoading } = useQuery({
    queryKey: ['teachers', directionId],
    queryFn: () => api.lessons.getTeachers(directionId),
    enabled: !!directionId,
  });

  const { data: slots, isLoading: slotsLoading } = useQuery({
    queryKey: ['slots', teacherId, date],
    queryFn: () => api.lessons.getAvailableSlots({ teacherId, date }),
    enabled: !!teacherId && !!date,
  });

  const bookMutation = useMutation({
    mutationFn: () => api.lessons.bookLesson({ teacherId, directionId, date, startTime }, user.id),
    onSuccess: (lesson) => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
      queryClient.invalidateQueries({ queryKey: ['slots', teacherId, date] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setBookedLessonId(lesson.id);
      setStep('success');
      setError('');
    },
    onError: (e) => {
      setError(e instanceof ApiError ? e.message : 'Ошибка записи');
      if (e instanceof ApiError && e.status === 409) {
        queryClient.invalidateQueries({ queryKey: ['slots', teacherId, date] });
      }
    },
  });

  const selectedDirection = directions?.find((d) => d.id === directionId);
  const selectedTeacher = teachers?.find((t) => t.id === teacherId);
  const durationMinutes = 60;
  const dateOptions = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i + 1));

  const goBack = () => {
    if (step === 'direction') goBackToLessons();
    else if (step === 'teacher') setStep('direction');
    else if (step === 'date') setStep('teacher');
    else if (step === 'slot') setStep('date');
    else setStep('slot');
  };

  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="page-container max-w-lg">
      <header className="mb-6">
        {step !== 'success' && (
          <button type="button" onClick={goBack} className={cn('mb-4', backNavButtonClassName)}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Назад
          </button>
        )}
        <h1 className="text-h1">Онлайн-запись</h1>
        {step !== 'success' && (
          <div className="mt-4 flex gap-1.5" aria-hidden>
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors duration-[var(--duration-normal)]',
                  stepIndex >= i ? 'bg-brand' : 'bg-surface-elevated',
                )}
              />
            ))}
          </div>
        )}
      </header>

      {!isOnline && step === 'confirm' && (
        <p className="mb-4 rounded-lg bg-danger-muted px-4 py-3 text-sm text-danger" role="alert">
          {OFFLINE_NETWORK_MESSAGE}
        </p>
      )}

      <div key={step} className="motion-safe:animate-fade-in">
        {step === 'direction' && (
          <section>
            <h2 className="mb-1 text-h2">Услуга</h2>
            <p className="mb-4 text-body-sm text-text-secondary">Выберите направление</p>
            {dirLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {directions?.map((d) => (
                  <Card
                    key={d.id}
                    interactive
                    className="min-h-[4.5rem]"
                    onClick={() => {
                      setDirectionId(d.id);
                      setStep('teacher');
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <span
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-muted text-2xl"
                        aria-hidden
                      >
                        {d.icon}
                      </span>
                      <div className="min-w-0">
                        <p className="text-h3">{d.name}</p>
                        <p className="text-body-sm text-text-secondary line-clamp-2">{d.description}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}

        {step === 'teacher' && (
          <section>
            <h2 className="mb-1 text-h2">Мастер</h2>
            <p className="mb-4 text-body-sm text-text-secondary">К кому записаться</p>
            {teachersLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {teachers?.map((t) => (
                  <Card
                    key={t.id}
                    interactive
                    className="min-h-[4.5rem]"
                    onClick={() => {
                      setTeacherId(t.id);
                      setStep('date');
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <UserPreviewTrigger user={t} className="shrink-0 rounded-full p-0">
                        <Avatar
                          src={t.avatarUrl}
                          firstName={t.firstName}
                          lastName={t.lastName}
                          size="lg"
                        />
                      </UserPreviewTrigger>
                      <div className="min-w-0">
                        <p className="text-h3">{formatUserName(t)}</p>
                        <p className="text-body-sm text-text-secondary line-clamp-2">{t.bio}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}

        {step === 'date' && (
          <section>
            <h2 className="mb-1 text-h2">Дата</h2>
            <p className="mb-4 text-body-sm text-text-secondary">Пролистайте и выберите день</p>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 scrollbar-none">
              {dateOptions.map((d) => {
                const ds = format(d, 'yyyy-MM-dd');
                const selected = date === ds;
                return (
                  <SelectableTile
                    key={ds}
                    selected={selected}
                    onClick={() => {
                      setDate(ds);
                      setStartTime('');
                      setStep('slot');
                    }}
                    className="min-h-[5.5rem] w-[4.75rem] shrink-0 px-2 py-3 text-center"
                    label={format(d, 'd MMMM', { locale: ru })}
                  >
                    <p className="text-caption capitalize">{format(d, 'EEE', { locale: ru })}</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums leading-none">
                      {format(d, 'd')}
                    </p>
                    <p className="mt-1 text-caption capitalize text-text-secondary">
                      {format(d, 'MMM', { locale: ru })}
                    </p>
                  </SelectableTile>
                );
              })}
            </div>
          </section>
        )}

        {step === 'slot' && (
          <section>
            <h2 className="mb-1 text-h2">Время</h2>
            <p className="mb-4 text-body-sm text-text-secondary">{formatFullDate(date)}</p>
            {slotsLoading ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            ) : slots && slots.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {slots.map((slot) => (
                  <SelectableTile
                    key={slot.startTime}
                    selected={startTime === slot.startTime}
                    onClick={() => {
                      setStartTime(slot.startTime);
                      setStep('confirm');
                    }}
                    className="min-h-14 py-3 text-center text-lg font-semibold tabular-nums"
                    label={slot.startTime}
                  >
                    {slot.startTime}
                  </SelectableTile>
                ))}
              </div>
            ) : (
              <Card>
                <p className="text-body-sm text-text-secondary">
                  На этот день свободных занятий нет. Попробуйте выбрать другую дату или другого
                  преподавателя.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setStep('date')}>
                    Изменить дату
                  </Button>
                  <Button variant="ghost" onClick={() => setStep('teacher')}>
                    Другой преподаватель
                  </Button>
                </div>
              </Card>
            )}
          </section>
        )}

        {step === 'confirm' && selectedDirection && selectedTeacher && (
          <section>
            <h2 className="mb-1 text-h2">Подтверждение</h2>
            <p className="mb-4 text-body-sm text-text-secondary">Проверьте запись перед подтверждением</p>
            <Card className="space-y-4 overflow-hidden p-0">
              <div className="bg-brand-muted/40 px-4 py-4">
                <p className="text-caption text-text-secondary">Время</p>
                <p className="text-3xl font-semibold tabular-nums tracking-tight">
                  {startTime}
                </p>
                <p className="mt-1 text-body-sm text-text-secondary">
                  {formatWeekday(date)}, {formatFullDate(date)} ·{' '}
                  {formatTimeRange(startTime, durationMinutes)}
                </p>
              </div>
              <div className="flex items-center gap-3 px-4 pb-4">
                <Avatar
                  src={selectedTeacher.avatarUrl}
                  firstName={selectedTeacher.firstName}
                  lastName={selectedTeacher.lastName}
                  size="lg"
                />
                <div className="min-w-0">
                  <p className="text-h3 truncate">{formatUserName(selectedTeacher)}</p>
                  <p className="text-body-sm text-text-secondary">{selectedDirection.name}</p>
                </div>
              </div>
            </Card>
            {error && (
              <p className="mt-4 text-sm text-danger" role="alert">
                {error}
              </p>
            )}
            <Button
              className="mt-6 min-h-12"
              fullWidth
              loading={bookMutation.isPending}
              disabled={!startTime || !isOnline || bookMutation.isPending}
              onClick={() => bookMutation.mutate()}
            >
              <Check className="h-4 w-4" aria-hidden />
              {bookMutation.isPending ? 'Записываем...' : 'Подтвердить запись'}
            </Button>
          </section>
        )}

        {step === 'success' && selectedDirection && selectedTeacher && (
          <section className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success-muted motion-safe:animate-scale-in">
              <Check className="h-8 w-8 text-success" aria-hidden />
            </div>
            <h2 className="text-h2">Запись подтверждена</h2>
            <Card className="mt-6 overflow-hidden p-0 text-left">
              <div className="bg-brand-muted/40 px-4 py-4">
                <p className="text-3xl font-semibold tabular-nums">{startTime}</p>
                <p className="mt-1 text-body-sm text-text-secondary">{formatFullDate(date)}</p>
              </div>
              <div className="space-y-1 px-4 py-4">
                <p className="text-h3">{selectedDirection.name}</p>
                <p className="text-body-sm text-text-secondary">с {formatUserName(selectedTeacher)}</p>
                <p className="text-body-sm tabular-nums">
                  {formatTimeRange(startTime, durationMinutes)}
                </p>
              </div>
            </Card>
            <div className="mt-6 flex flex-col gap-3">
              <Link to={`/lessons/${bookedLessonId}`}>
                <Button fullWidth className="min-h-12">
                  Перейти к занятию
                </Button>
              </Link>
              <Button variant="secondary" fullWidth onClick={() => navigate('/lessons')}>
                К списку занятий
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
