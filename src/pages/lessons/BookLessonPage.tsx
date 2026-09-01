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

import { cn, formatUserName } from '@/utils';

import { formatFullDate, formatTimeRange, formatWeekday } from '@/utils/dates';



type Step = 'direction' | 'teacher' | 'date' | 'slot' | 'confirm' | 'success';



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

    mutationFn: () =>

      api.lessons.bookLesson({ teacherId, directionId, date, startTime }, user.id),

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



  return (

    <div className="page-container max-w-lg">

      <header className="mb-6">

        {step !== 'success' && (

          <button

            type="button"

            onClick={goBack}

            className={cn('mb-4', backNavButtonClassName)}

          >

            <ChevronLeft className="h-4 w-4" aria-hidden />

            Назад

          </button>

        )}

        <h1 className="text-h1">Запись на занятие</h1>

        {step !== 'success' && (

          <div className="mt-4 flex gap-1" aria-hidden>

            {(['direction', 'teacher', 'date', 'slot', 'confirm'] as Step[]).map((s, i) => (

              <div

                key={s}

                className={cn(

                  'h-1 flex-1 rounded-full',

                  (['direction', 'teacher', 'date', 'slot', 'confirm'].indexOf(step) >= i)

                    ? 'bg-brand'

                    : 'bg-surface-elevated',

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



      {step === 'direction' && (

        <section>

          <h2 className="mb-4 text-h2">Направление</h2>

          {dirLoading ? (

            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>

          ) : (

            <div className="space-y-3">

              {directions?.map((d) => (

                <Card

                  key={d.id}

                  interactive

                  onClick={() => { setDirectionId(d.id); setStep('teacher'); }}

                >

                  <div className="flex items-center gap-4">

                    <span className="text-2xl" aria-hidden>{d.icon}</span>

                    <div>

                      <p className="text-h3">{d.name}</p>

                      <p className="text-body-sm text-text-secondary">{d.description}</p>

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

          <h2 className="mb-4 text-h2">Преподаватель</h2>

          {teachersLoading ? (

            <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>

          ) : (

            <div className="space-y-3">

              {teachers?.map((t) => (

                <Card

                  key={t.id}

                  interactive

                  onClick={() => { setTeacherId(t.id); setStep('date'); }}

                >

                  <div className="flex items-center gap-4">

                    <Avatar firstName={t.firstName} lastName={t.lastName} size="lg" />

                    <div>

                      <p className="text-h3">{formatUserName(t)}</p>

                      <p className="text-body-sm text-text-secondary">{t.bio}</p>

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

          <h2 className="mb-4 text-h2">Дата</h2>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">

            {dateOptions.map((d) => {

              const ds = format(d, 'yyyy-MM-dd');

              return (

                <button

                  key={ds}

                  type="button"

                  onClick={() => { setDate(ds); setStartTime(''); setStep('slot'); }}

                  className={cn(

                    'min-h-11 rounded-xl border p-3 text-left transition-colors focus-ring',

                    date === ds ? 'border-brand bg-brand-muted' : 'border-border-subtle bg-surface hover:bg-surface-elevated',

                  )}

                >

                  <p className="text-caption capitalize">{format(d, 'EEE', { locale: ru })}</p>

                  <p className="text-lg font-semibold tabular-nums">{format(d, 'd MMM', { locale: ru })}</p>

                </button>

              );

            })}

          </div>

        </section>

      )}



      {step === 'slot' && (

        <section>

          <h2 className="mb-1 text-h2">Доступное время</h2>

          <p className="mb-4 text-body-sm text-text-secondary">{formatFullDate(date)}</p>

          {slotsLoading ? (

            <div className="grid grid-cols-3 gap-2">{[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-11" />)}</div>

          ) : slots && slots.length > 0 ? (

            <div className="grid grid-cols-3 gap-2">

              {slots.map((slot) => (

                <button

                  key={slot.startTime}

                  type="button"

                  onClick={() => { setStartTime(slot.startTime); setStep('confirm'); }}

                  className={cn(

                    'min-h-11 rounded-lg border py-2.5 text-sm font-medium tabular-nums transition-colors focus-ring',

                    startTime === slot.startTime

                      ? 'border-brand bg-brand-muted text-brand'

                      : 'border-border-subtle bg-surface-elevated hover:border-brand/50',

                  )}

                >

                  {slot.startTime}

                </button>

              ))}

            </div>

          ) : (

            <Card>

              <p className="text-body-sm text-text-secondary">

                На этот день свободных занятий нет. Попробуйте выбрать другую дату или другого преподавателя.

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

          <h2 className="mb-4 text-h2">Выбранное время</h2>

          <Card className="space-y-4">

            <div className="flex items-center gap-3">

              <Avatar firstName={selectedTeacher.firstName} lastName={selectedTeacher.lastName} size="lg" />

              <div>

                <p className="text-h3">{formatUserName(selectedTeacher)}</p>

                <p className="text-body-sm text-text-secondary">{selectedDirection.name}</p>

              </div>

            </div>

            <div className="border-t border-border-subtle pt-4 space-y-2">

              <p className="text-body-sm">

                <span className="text-text-muted">Дата:</span>{' '}

                {formatWeekday(date)}, {formatFullDate(date)}

              </p>

              <p className="text-body-sm tabular-nums">

                <span className="text-text-muted">Время:</span>{' '}

                {formatTimeRange(startTime, durationMinutes)}

              </p>

            </div>

          </Card>

          {error && <p className="mt-4 text-sm text-danger" role="alert">{error}</p>}

          <Button

            className="mt-6"

            fullWidth

            loading={bookMutation.isPending}

            disabled={!startTime || !isOnline || bookMutation.isPending}

            onClick={() => bookMutation.mutate()}

          >

            <Check className="h-4 w-4" aria-hidden />

            {bookMutation.isPending ? 'Записываем...' : 'Записаться'}

          </Button>

        </section>

      )}



      {step === 'success' && selectedDirection && selectedTeacher && (

        <section className="text-center">

          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success-muted">

            <Check className="h-8 w-8 text-success" aria-hidden />

          </div>

          <h2 className="text-h2">Занятие запланировано</h2>

          <Card className="mt-6 text-left">

            <p className="text-h3">{selectedDirection.name}</p>

            <p className="text-body-sm text-text-secondary">с {formatUserName(selectedTeacher)}</p>

            <p className="mt-3 text-body-sm">{formatFullDate(date)}</p>

            <p className="text-body-sm tabular-nums">{formatTimeRange(startTime, durationMinutes)}</p>

          </Card>

          <div className="mt-6 flex flex-col gap-3">

            <Link to={`/lessons/${bookedLessonId}`}>

              <Button fullWidth>Перейти к занятию</Button>

            </Link>

            <Button variant="secondary" fullWidth onClick={() => navigate('/lessons')}>

              Перейти к занятиям

            </Button>

          </div>

        </section>

      )}

    </div>

  );

}


