import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, CalendarDays } from 'lucide-react';
import { useCurrentUser } from '@/stores/authStore';
import { api } from '@/services/api';
import { actsAsTeacher, can } from '@/permissions';
import { isYclientsLessonsEnabled } from '@/config/features';
import { Button } from '@/components/ui/Button';
import { LessonCard } from '@/components/ui/LessonCard';
import { LessonCardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { BookLessonLink } from '@/components/ui/BookLessonLink';
import { LessonCalendar } from '@/components/calendar/LessonCalendar';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

type PageView = 'calendar' | 'list';

const VIEW_OPTIONS = [
  { value: 'calendar' as const, label: 'Расписание' },
  { value: 'list' as const, label: 'Визиты' },
];

export default function LessonsPage() {
  const user = useCurrentUser()!;
  const teacherView = actsAsTeacher(user.role);
  const [pageView, setPageView] = useState<PageView>('calendar');

  const { data: lessons, isLoading, error, refetch } = useQuery({
    queryKey: ['lessons', 'list', user.id, user.role],
    queryFn: async () => {
      const base = { requesterId: user.id };
      if (teacherView) return api.lessons.getLessons({ ...base, teacherId: user.id });
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
    queryFn: () => api.users.getAllUsers(user.id),
    enabled: user.role !== 'student',
  });

  const upcoming = lessons
    ?.filter((l) => !['cancelled', 'completed', 'no_show'].includes(l.status))
    .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));

  const todayIso = new Date().toISOString().slice(0, 10);
  const todayLessons = upcoming?.filter((l) => l.date === todayIso);
  const laterUpcoming = upcoming?.filter((l) => l.date !== todayIso);

  const getDirectionName = (id: string) => directions?.find((d) => d.id === id)?.name ?? '';
  const getTeacher = (id: string) => teachers?.find((t) => t.id === id);
  const getStudent = (id: string) => students?.find((u) => u.id === id);

  if (error) {
    return (
      <div className="page-container">
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="page-container">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-h1">Занятия</h1>
          <p className="mt-0.5 text-body-sm text-text-secondary">Личный кабинет записей</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {can(user, 'availability:manage') && isYclientsLessonsEnabled() && (
            <Link to="/lessons/availability">
              <Button variant="secondary" size="sm">
                График работы
              </Button>
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

      <SegmentedControl
        className="mb-5 w-full max-w-md"
        aria-label="Вид занятий"
        value={pageView}
        options={VIEW_OPTIONS}
        onChange={setPageView}
      />

      {pageView === 'calendar' ? (
        <section className="mb-0 rounded-2xl border border-border-subtle bg-surface p-3 sm:p-4">
          <LessonCalendar viewer={user} className="mb-0" />
        </section>
      ) : (
        <div className="space-y-8 motion-safe:animate-fade-in">
          {isLoading ? (
            <div className="space-y-3">
              <LessonCardSkeleton />
              <LessonCardSkeleton />
            </div>
          ) : todayLessons && todayLessons.length > 0 ? (
            <section>
              <h2 className="mb-3 text-label">Сегодня</h2>
              <div className="space-y-3">
                {todayLessons.map((lesson) => (
                  <LessonCard
                    key={lesson.id}
                    lesson={lesson}
                    directionName={getDirectionName(lesson.directionId)}
                    teacher={getTeacher(lesson.teacherId)}
                    student={getStudent(lesson.studentId)}
                    showTeacher={!teacherView}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {!isLoading && laterUpcoming && laterUpcoming.length > 0 ? (
            <section>
              <h2 className="mb-3 text-label">Предстоящие визиты</h2>
              <div className="space-y-3">
                {laterUpcoming.map((lesson) => (
                  <LessonCard
                    key={lesson.id}
                    lesson={lesson}
                    directionName={getDirectionName(lesson.directionId)}
                    teacher={getTeacher(lesson.teacherId)}
                    student={getStudent(lesson.studentId)}
                    showTeacher={!teacherView}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {!isLoading && (!upcoming || upcoming.length === 0) ? (
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
        </div>
      )}
    </div>
  );
}
