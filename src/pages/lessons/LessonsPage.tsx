import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, List, CalendarDays, History } from 'lucide-react';
import { useCurrentUser } from '@/stores/authStore';
import { api } from '@/services/api';
import { can } from '@/permissions';
import type { LessonStatus } from '@/types';
import { Button } from '@/components/ui/Button';
import { LessonCard } from '@/components/ui/LessonCard';
import { LessonCardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { BookLessonLink } from '@/components/ui/BookLessonLink';
import { LessonCalendar } from '@/components/calendar/LessonCalendar';
import { cn } from '@/utils';

type PageView = 'calendar' | 'list';

type HistoryFilter = 'all' | 'completed' | 'cancelled' | 'rescheduled' | 'no_show';

const HISTORY_FILTERS: { id: HistoryFilter; label: string; statuses: LessonStatus[] }[] = [
  { id: 'all', label: 'Все', statuses: ['completed', 'cancelled', 'rescheduled', 'no_show'] },
  { id: 'completed', label: 'Состоялись', statuses: ['completed'] },
  { id: 'cancelled', label: 'Отменены', statuses: ['cancelled'] },
  { id: 'rescheduled', label: 'Перенесены', statuses: ['rescheduled'] },
  { id: 'no_show', label: 'Не состоялись', statuses: ['no_show'] },
];

export default function LessonsPage() {
  const user = useCurrentUser()!;
  const [pageView, setPageView] = useState<PageView>('calendar');
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');

  const { data: lessons, isLoading, error, refetch } = useQuery({
    queryKey: ['lessons', 'list', user.id, user.role],
    queryFn: async () => {
      const base = { requesterId: user.id };
      if (user.role === 'teacher') return api.lessons.getLessons({ ...base, teacherId: user.id });
      if (user.role === 'admin') return api.lessons.getLessons(base);
      return api.lessons.getLessons({ ...base, studentId: user.id });
    },
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
    queryKey: ['users'],
    queryFn: () => api.users.getAllUsers(),
    enabled: user.role !== 'student',
  });

  const upcoming = lessons
    ?.filter((l) => !['cancelled', 'completed', 'no_show'].includes(l.status))
    .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));

  const todayLessons = upcoming?.filter((l) => l.date === new Date().toISOString().slice(0, 10));

  const activeHistoryFilter = HISTORY_FILTERS.find((f) => f.id === historyFilter)!;
  const past = lessons
    ?.filter((l) => activeHistoryFilter.statuses.includes(l.status))
    .sort((a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`));

  const getDirectionName = (id: string) => directions?.find((d) => d.id === id)?.name ?? '';
  const getTeacher = (id: string) => teachers?.find((t) => t.id === id);
  const getStudent = (id: string) => students?.find((u) => u.id === id);

  if (error) return <div className="page-container"><ErrorState onRetry={() => refetch()} /></div>;

  return (
    <div className="page-container">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-h1">Занятия</h1>
        <div className="flex items-center gap-2">
          {can(user, 'availability:manage') && (
            <Link to="/profile/availability">
              <Button variant="secondary" size="sm">График работы</Button>
            </Link>
          )}
          {can(user, 'lessons:book') && (
            <BookLessonLink size="sm">
              <Plus className="h-4 w-4" aria-hidden />
              Запись
            </BookLessonLink>
          )}
        </div>
      </header>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setPageView('calendar')}
          className={cn(
            'flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium focus-ring',
            pageView === 'calendar' ? 'bg-brand-muted text-brand' : 'text-text-muted hover:bg-surface-elevated',
          )}
        >
          <CalendarDays className="h-4 w-4" aria-hidden />
          Календарь
        </button>
        <button
          type="button"
          onClick={() => setPageView('list')}
          className={cn(
            'flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium focus-ring',
            pageView === 'list' ? 'bg-brand-muted text-brand' : 'text-text-muted hover:bg-surface-elevated',
          )}
        >
          <List className="h-4 w-4" aria-hidden />
          Список
        </button>
      </div>

      {pageView === 'calendar' ? (
        <LessonCalendar viewer={user} className="mb-8" />
      ) : (
        <>
          {(user.role === 'teacher' ? todayLessons : upcoming)?.length ? (
            <section className="mb-8">
              <h2 className="mb-3 text-label">
                {user.role === 'teacher' ? 'Сегодня' : 'Предстоящие'}
              </h2>
              {isLoading ? (
                <div className="space-y-3">
                  <LessonCardSkeleton />
                  <LessonCardSkeleton />
                </div>
              ) : (
                <div className="space-y-3">
                  {(user.role === 'teacher' ? todayLessons : upcoming)?.map((lesson) => (
                    <LessonCard
                      key={lesson.id}
                      lesson={lesson}
                      directionName={getDirectionName(lesson.directionId)}
                      teacher={getTeacher(lesson.teacherId)}
                      student={getStudent(lesson.studentId)}
                      showTeacher={user.role === 'student'}
                    />
                  ))}
                </div>
              )}
            </section>
          ) : !isLoading ? (
            <EmptyState
              icon={CalendarDays}
              title="Пока нет предстоящих занятий"
              description="Запишитесь на удобное время"
              action={
                can(user, 'lessons:book') ? (
                  <BookLessonLink>Найти занятие</BookLessonLink>
                ) : undefined
              }
            />
          ) : null}

          <section className="mb-8">
            <h2 className="mb-3 text-label">Ближайшее расписание</h2>
            {isLoading ? (
              <LessonCardSkeleton />
            ) : upcoming && upcoming.length > 0 ? (
              <div className="space-y-3">
                {upcoming.slice(0, 5).map((lesson) => (
                  <LessonCard
                    key={lesson.id}
                    lesson={lesson}
                    directionName={getDirectionName(lesson.directionId)}
                    teacher={getTeacher(lesson.teacherId)}
                    student={getStudent(lesson.studentId)}
                    showTeacher={user.role === 'student'}
                  />
                ))}
              </div>
            ) : null}
          </section>
        </>
      )}

      <section>
        <h2 className="mb-3 text-label">История</h2>
        <div className="mb-4 flex flex-wrap gap-2">
          {HISTORY_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setHistoryFilter(f.id)}
              aria-pressed={historyFilter === f.id}
              className={cn(
                'min-h-11 rounded-lg px-3 py-1.5 text-sm focus-ring',
                historyFilter === f.id
                  ? 'bg-brand-muted text-brand'
                  : 'bg-surface-elevated text-text-muted hover:text-text-secondary',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {isLoading ? (
          <LessonCardSkeleton />
        ) : past && past.length > 0 ? (
          <div className="space-y-3 opacity-90">
            {past.map((lesson) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                directionName={getDirectionName(lesson.directionId)}
                teacher={getTeacher(lesson.teacherId)}
                student={getStudent(lesson.studentId)}
                showTeacher={user.role === 'student'}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={History}
            title="Нет занятий"
            description="В этой категории истории занятий пока нет."
            className="py-8"
          />
        )}
      </section>
    </div>
  );
}
