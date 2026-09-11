import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Sparkles, Plus, CalendarDays } from 'lucide-react';
import { useCurrentUser } from '@/stores/authStore';
import { api } from '@/services/api';
import { actsAsTeacher, can, getRoleLabel } from '@/permissions';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { LessonCard } from '@/components/ui/LessonCard';
import { LessonCardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { BookLessonLink } from '@/components/ui/BookLessonLink';
import { HomeEventCard } from '@/components/events/HomeEventCard';
import { HomeAssignmentsBlock } from '@/components/assignments/HomeAssignmentsBlock';
import { getNextUpcomingEvent } from '@/services/events/helpers';
import { formatUserName } from '@/utils';
import { formatLessonDateTime } from '@/utils/dates';
import type { User } from '@/types';

function homeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

function HomeGreetingHeader({ user }: { user: User }) {
  return (
    <header className="mb-6">
      <p className="text-body-sm text-text-muted">{homeGreeting()}</p>
      <div className="mt-2 flex items-center gap-4">
        <Avatar
          src={user.avatarUrl}
          firstName={user.firstName}
          lastName={user.lastName}
          size="lg"
          className="h-14 w-14 shrink-0 text-xl ring-2 ring-surface-elevated sm:h-16 sm:w-16"
        />
        <div className="min-w-0">
          <h1 className="text-h1">{formatUserName(user)}</h1>
          <p className="mt-1 text-body-sm text-brand">{getRoleLabel(user.role)}</p>
        </div>
      </div>
    </header>
  );
}

function isUpcomingLesson(status: string) {
  return status !== 'cancelled' && status !== 'completed' && status !== 'no_show';
}

export default function HomePage() {
  const user = useCurrentUser()!;
  const teacherView = actsAsTeacher(user.role);

  const {
    data: lessons,
    isLoading: lessonsLoading,
    error: lessonsError,
    refetch: refetchLessons,
  } = useQuery({
    queryKey: ['lessons', 'upcoming', user.id, user.role],
    queryFn: async () => {
      const base = { requesterId: user.id };
      if (teacherView) {
        return api.lessons.getLessons({ ...base, teacherId: user.id });
      }
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

  const {
    data: events,
    error: eventsError,
    refetch: refetchEvents,
  } = useQuery({
    queryKey: ['events', user.id],
    queryFn: () => api.events.getEvents(user.id),
  });

  const upcomingLessons = lessons
    ?.filter((l) => isUpcomingLesson(l.status))
    .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));

  const upcoming = upcomingLessons?.slice(0, 3);
  const nextLesson = upcomingLessons?.[0];
  const nextEvent = events ? getNextUpcomingEvent(events) : undefined;

  const getDirectionName = (id: string) => directions?.find((d) => d.id === id)?.name ?? '';
  const getTeacher = (id: string) =>
    teachers?.find((t) => t.id === id) ?? students?.find((u) => u.id === id && u.role === 'teacher');
  const getStudent = (id: string) => students?.find((u) => u.id === id);

  const showTeacherInCard = !teacherView;
  const showStudentInCard = teacherView;
  const showBookCta = can(user, 'lessons:book');
  const showAssignmentsBlock = can(user, 'assignments:view-own');

  const retryLessons = () => void refetchLessons();
  const retryEvents = () => void refetchEvents();

  return (
    <div className="page-container">
      <HomeGreetingHeader user={user} />

      {showBookCta && (
        <Card className="mb-6 border-brand/20 bg-gradient-to-br from-brand-muted to-transparent">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-h3">Записаться на занятие</h2>
              <p className="mt-1 text-body-sm text-text-secondary">Выберите направление и удобное время</p>
            </div>
            <BookLessonLink size="icon" aria-label="Записаться">
              <Plus className="h-5 w-5" />
            </BookLessonLink>
          </div>
        </Card>
      )}

      <section className="mb-6">
        <h2 className="mb-3 text-label uppercase tracking-wide">Ближайшее занятие</h2>
        {lessonsError ? (
          <ErrorState onRetry={retryLessons} />
        ) : lessonsLoading ? (
          <LessonCardSkeleton />
        ) : nextLesson ? (
          <LessonCard
            lesson={nextLesson}
            directionName={getDirectionName(nextLesson.directionId)}
            teacher={showTeacherInCard ? getTeacher(nextLesson.teacherId) : undefined}
            student={showStudentInCard ? getStudent(nextLesson.studentId) : undefined}
            showTeacher={showTeacherInCard}
          />
        ) : (
          <EmptyState
            icon={CalendarDays}
            title="Пока нет предстоящих занятий"
            description="Запишитесь на удобное время"
            className="py-8"
            action={
              showBookCta ? (
                <BookLessonLink size="sm">Найти занятие</BookLessonLink>
              ) : undefined
            }
          />
        )}
      </section>

      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-label uppercase tracking-wide">Ближайшее мероприятие</h2>
          <Link to="/events" className="text-sm text-brand hover:underline">
            Все
          </Link>
        </div>
        {eventsError ? (
          <ErrorState onRetry={retryEvents} />
        ) : nextEvent ? (
          <Link to={`/events/${nextEvent.id}`}>
            <HomeEventCard
              title={nextEvent.title}
              subtitle={`${formatLessonDateTime(nextEvent.date, nextEvent.startTime)} · ${nextEvent.location}`}
              imageUrl={nextEvent.imageUrl}
            />
          </Link>
        ) : events ? (
          <EmptyState
            icon={Sparkles}
            title="Нет предстоящих мероприятий"
            description="Следите за анонсами школы"
            className="py-8"
          />
        ) : null}
      </section>

      {showAssignmentsBlock && (
        <HomeAssignmentsBlock studentId={user.id} requesterId={user.id} />
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-label uppercase tracking-wide">Предстоящие занятия</h2>
          <Link to="/lessons" className="text-sm text-brand hover:underline">
            Все
          </Link>
        </div>
        {lessonsError ? null : lessonsLoading ? (
          <div className="space-y-3">
            <LessonCardSkeleton />
            <LessonCardSkeleton />
          </div>
        ) : upcoming && upcoming.length > 1 ? (
          <div className="space-y-3">
            {upcoming.slice(1).map((lesson) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                directionName={getDirectionName(lesson.directionId)}
                teacher={showTeacherInCard ? getTeacher(lesson.teacherId) : undefined}
                student={showStudentInCard ? getStudent(lesson.studentId) : undefined}
                showTeacher={showTeacherInCard}
              />
            ))}
          </div>
        ) : !nextLesson ? (
          <EmptyState
            icon={CalendarDays}
            title="Пока нет предстоящих занятий"
            description="Запишитесь на удобное время"
            className="py-8"
            action={
              showBookCta ? (
                <BookLessonLink size="sm">Найти занятие</BookLessonLink>
              ) : undefined
            }
          />
        ) : null}
      </section>
    </div>
  );
}
