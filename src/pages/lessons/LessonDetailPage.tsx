import { useState, useEffect } from 'react';

import { useParams, useNavigate, Link } from 'react-router-dom';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { format, addDays } from 'date-fns';

import { BackLink } from '@/components/ui/BackLink';
import { Calendar, Clock, MapPin, ArrowRightLeft, XCircle, FileText, MessageCircle, StickyNote } from 'lucide-react';

import { useCurrentUser } from '@/stores/authStore';

import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';

import { api } from '@/services/api';

import { ApiError } from '@/services/api/types';

import { canRescheduleLesson, canCancelLesson, canEditTeacherNotes } from '@/services/lessons/access';
import { canViewTeacherNotes } from '@/services/lessons/helpers';

import { Button } from '@/components/ui/Button';

import { Card } from '@/components/ui/Card';

import { Badge } from '@/components/ui/Badge';

import { LessonStatusBadge } from '@/components/ui/LessonStatusBadge';

import { Avatar } from '@/components/ui/Avatar';

import { Modal } from '@/components/ui/Modal';

import { ErrorState } from '@/components/ui/ErrorState';

import { LessonCardSkeleton } from '@/components/ui/Skeleton';

import { formatFullDate, formatLessonDateTime, formatTimeRange } from '@/utils/dates';

import { cn, formatUserName } from '@/utils';



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
  const [teacherNotesDraft, setTeacherNotesDraft] = useState('');
  const [notesError, setNotesError] = useState('');
  const [error, setError] = useState('');



  const { data: lesson, isLoading, error: loadError, refetch } = useQuery({

    queryKey: ['lesson', id],

    queryFn: () => api.lessons.getLesson(id!, user.id),

    enabled: !!id,

    retry: (_count, err) => !(err instanceof ApiError && err.status === 403),

  });



  const { data: directions } = useQuery({ queryKey: ['directions'], queryFn: () => api.lessons.getDirections() });

  const { data: teachers } = useQuery({ queryKey: ['teachers'], queryFn: () => api.lessons.getTeachers() });

  const { data: students } = useQuery({

    queryKey: ['students'],

    queryFn: () => api.users.getAllUsers(),

    enabled: user.role !== 'student',

  });

  const { data: history } = useQuery({

    queryKey: ['lesson-history', id],

    queryFn: () => api.lessons.getLessonHistory(id!, user.id),

    enabled: !!id && !!lesson,

  });

  const { data: lessonChat } = useQuery({

    queryKey: ['lesson-chat', id, user.id],

    queryFn: () => api.chat.getConversationForLesson(id!, user.id),

    enabled: !!id && !!lesson,

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

  const notesMutation = useMutation({

    mutationFn: () => api.lessons.updateTeacherNotes(id!, teacherNotesDraft, user.id),

    onSuccess: () => {

      queryClient.invalidateQueries({ queryKey: ['lesson', id] });

      setNotesError('');

    },

    onError: (e) => setNotesError(e instanceof ApiError ? e.message : 'Ошибка сохранения'),

  });

  useEffect(() => {

    setTeacherNotesDraft(lesson?.teacherNotes ?? '');

  }, [lesson?.id, lesson?.teacherNotes]);



  if (isLoading) return <div className="page-container"><LessonCardSkeleton /></div>;



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



  if (loadError || !lesson) return <div className="page-container"><ErrorState onRetry={() => refetch()} /></div>;



  const teacher = teachers?.find((t) => t.id === lesson.teacherId);

  const student = students?.find((s) => s.id === lesson.studentId);

  const direction = directions?.find((d) => d.id === lesson.directionId);

  const canReschedule = canRescheduleLesson(user, lesson);

  const canCancel = canCancelLesson(user, lesson);

  const showTeacherNotes = canViewTeacherNotes(user);

  const canEditNotes = canEditTeacherNotes(user, lesson);

  const materials = lesson.materials ?? [];

  const notesDirty = teacherNotesDraft !== (lesson.teacherNotes ?? '');



  const dateOptions = Array.from({ length: 14 }, (_, i) => format(addDays(new Date(), i + 1), 'yyyy-MM-dd'));



  return (

    <div className="page-container max-w-lg">

      <BackLink label="К занятиям" fallbackTo="/lessons" />



      <header className="mb-6">

        <div className="flex items-center gap-2 mb-2">

          <Badge variant="brand">{direction?.name}</Badge>

          <LessonStatusBadge status={lesson.status} />

        </div>

        <h1 className="text-h1">{direction?.name}</h1>

      </header>



      <Card className="mb-4 space-y-4">

        {teacher && (

          <div className="flex items-center gap-3">

            <Avatar firstName={teacher.firstName} lastName={teacher.lastName} size="lg" />

            <div>

              <p className="text-caption">Преподаватель</p>

              <p className="text-h3">{formatUserName(teacher)}</p>

            </div>

          </div>

        )}

        {student && user.role !== 'student' && (

          <div className="flex items-center gap-3 border-t border-border-subtle pt-4">

            <Avatar firstName={student.firstName} lastName={student.lastName} />

            <div>

              <p className="text-caption">Ученик</p>

              <p className="font-medium">{formatUserName(student)}</p>

            </div>

          </div>

        )}

        <div className="space-y-2 border-t border-border-subtle pt-4">

          <p className="flex items-center gap-2 text-body-sm">

            <Calendar className="h-4 w-4 text-text-muted" aria-hidden />

            {formatFullDate(lesson.date)}

          </p>

          <p className="flex items-center gap-2 text-body-sm tabular-nums">

            <Clock className="h-4 w-4 text-text-muted" aria-hidden />

            {formatTimeRange(lesson.startTime, lesson.durationMinutes)} · {lesson.durationMinutes} мин

          </p>

          {lesson.location && (

            <p className="flex items-center gap-2 text-body-sm">

              <MapPin className="h-4 w-4 text-text-muted" aria-hidden />

              {lesson.location}

            </p>

          )}

        </div>

      </Card>



      {lessonChat && (

        <section className="mb-4">

          <Link

            to={`/chat/${lessonChat.id}`}

            className="flex min-h-11 items-center gap-3 rounded-xl border border-border-subtle bg-surface-elevated px-4 py-3 hover:border-brand/30 focus-ring"

          >

            <MessageCircle className="h-5 w-5 shrink-0 text-brand" aria-hidden />

            <div className="min-w-0">

              <p className="text-label">Чат по занятию</p>

              <p className="truncate text-caption text-text-muted">

                {lessonChat.title ?? 'Открыть переписку'}

              </p>

            </div>

          </Link>

        </section>

      )}



      {materials.length > 0 && (

        <section className="mb-4" aria-labelledby="lesson-materials-heading">

          <h2 id="lesson-materials-heading" className="mb-2 text-label uppercase tracking-wide">

            Материалы

          </h2>

          <ul className="space-y-2">

            {materials.map((material) => (

              <li key={material.id}>

                <a href={material.url} target="_blank" rel="noopener noreferrer">

                  <Card padding="sm" className="flex items-center gap-2 hover:border-brand/30">

                    <FileText className="h-4 w-4 text-brand" aria-hidden />

                    <span className="text-sm">{material.filename}</span>

                  </Card>

                </a>

              </li>

            ))}

          </ul>

        </section>

      )}



      {showTeacherNotes && (

        <section className="mb-6" aria-labelledby="teacher-notes-heading">

          <h2 id="teacher-notes-heading" className="mb-2 flex items-center gap-2 text-label uppercase tracking-wide">

            <StickyNote className="h-4 w-4" aria-hidden />

            Заметки преподавателя

          </h2>

          <Card>

            {canEditNotes ? (

              <div className="space-y-3">

                <textarea

                  className="w-full rounded-lg border border-border bg-surface-elevated p-3 text-sm focus-ring"

                  placeholder="Внутренние заметки (не видны ученику)"

                  rows={4}

                  value={teacherNotesDraft}

                  onChange={(e) => setTeacherNotesDraft(e.target.value)}

                />

                {!isOnline && (

                  <p className="text-sm text-danger" role="alert">

                    {OFFLINE_NETWORK_MESSAGE}

                  </p>

                )}

                {notesError && <p className="text-sm text-danger" role="alert">{notesError}</p>}

                <Button

                  size="sm"

                  disabled={!isOnline || !notesDirty}

                  loading={notesMutation.isPending}

                  onClick={() => notesMutation.mutate()}

                >

                  {notesMutation.isPending ? 'Сохраняем...' : 'Сохранить заметки'}

                </Button>

              </div>

            ) : lesson.teacherNotes ? (

              <p className="text-body-sm whitespace-pre-wrap">{lesson.teacherNotes}</p>

            ) : (

              <p className="text-body-sm text-text-secondary">Заметок нет</p>

            )}

          </Card>

        </section>

      )}



      {history && history.length > 0 && (

        <section className="mb-6">

          <h2 className="mb-3 text-label">История изменений</h2>

          <div className="space-y-2">

            {history.map((h) => (

              <Card key={h.id} padding="sm">

                <p className="text-body-sm">

                  {h.action === 'created' && `Создано: ${h.newDate} ${h.newStartTime}`}

                  {h.action === 'rescheduled' && `Перенесено: ${h.previousDate} ${h.previousStartTime} → ${h.newDate} ${h.newStartTime}`}

                  {h.action === 'cancelled' && `Отменено${h.reason ? `: ${h.reason}` : ''}`}

                </p>

              </Card>

            ))}

          </div>

        </section>

      )}



      {(canReschedule || canCancel) && (

        <div className="flex gap-3">

          {canReschedule && (

            <Button
              variant="secondary"
              fullWidth
              disabled={!isOnline}
              onClick={() => {
                if (!isOnline) return;
                setShowReschedule(true);
                setNewDate(lesson.date);
                setError('');
              }}
            >

              <ArrowRightLeft className="h-4 w-4" aria-hidden />

              Перенести

            </Button>

          )}

          {canCancel && (

            <Button
              variant="destructive"
              fullWidth
              disabled={!isOnline}
              onClick={() => {
                if (!isOnline) return;
                setShowCancel(true);
                setError('');
              }}
            >

              <XCircle className="h-4 w-4" aria-hidden />

              Отменить

            </Button>

          )}

        </div>

      )}



      <Modal open={showReschedule} onClose={() => setShowReschedule(false)} title="Перенести занятие">

        <div className="space-y-4">

          <Card padding="sm">

            <p className="text-caption">Текущее</p>

            <p className="text-body-sm tabular-nums">

              {formatTimeRange(lesson.startTime, lesson.durationMinutes)} · {formatFullDate(lesson.date)}

            </p>

          </Card>

          <div>

            <p className="text-label mb-2">Новая дата</p>

            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">

              {dateOptions.map((d) => (

                <button

                  key={d}

                  type="button"

                  onClick={() => { setNewDate(d); setNewTime(''); }}

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

          {newDate && (

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

          )}

          {!isOnline && (

            <p className="text-sm text-danger" role="alert">

              {OFFLINE_NETWORK_MESSAGE}

            </p>

          )}

          {error && <p className="text-sm text-danger" role="alert">{error}</p>}

          <Button

            fullWidth

            disabled={!newDate || !newTime || !isOnline}

            loading={rescheduleMutation.isPending}

            onClick={() => rescheduleMutation.mutate()}

          >

            {rescheduleMutation.isPending ? 'Переносим...' : 'Перенести'}

          </Button>

        </div>

      </Modal>



      <Modal open={showCancel} onClose={() => setShowCancel(false)} title="Отменить занятие?">

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

          {error && <p className="text-sm text-danger" role="alert">{error}</p>}

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

        </div>

      </Modal>

    </div>

  );

}


