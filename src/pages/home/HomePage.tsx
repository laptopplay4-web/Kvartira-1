import { useQuery } from '@tanstack/react-query';

import { Link } from 'react-router-dom';

import { Sparkles, Plus, Users, CalendarDays, FileText, PartyPopper, Building2 } from 'lucide-react';

import { useCurrentUser } from '@/stores/authStore';

import { api } from '@/services/api';

import { can } from '@/permissions';

import { Card } from '@/components/ui/Card';

import { LessonCard } from '@/components/ui/LessonCard';

import { LessonCardSkeleton, Skeleton } from '@/components/ui/Skeleton';

import { ErrorState } from '@/components/ui/ErrorState';

import { EmptyState } from '@/components/ui/EmptyState';

import { BookLessonLink } from '@/components/ui/BookLessonLink';

import { HomeAssignmentsBlock } from '@/components/assignments/HomeAssignmentsBlock';
import { HomeProgressBlock } from '@/components/progress/HomeProgressBlock';

import { getNextUpcomingEvent } from '@/services/events/helpers';

import { getLessonCounterpartyName } from '@/services/calendar/helpers';

import { formatUserName } from '@/utils';

import { formatLessonDateTime } from '@/utils/dates';



function todayISO() {

  return new Date().toISOString().slice(0, 10);

}



function isUpcomingLesson(status: string) {

  return status !== 'cancelled' && status !== 'completed' && status !== 'no_show';

}



interface StatCardProps {

  label: string;

  value: number | string;

  loading?: boolean;

}



function StatCard({ label, value, loading }: StatCardProps) {

  return (

    <Card padding="sm" className="text-center">

      {loading ? (

        <Skeleton className="mx-auto h-8 w-10" aria-hidden />

      ) : (

        <p className="text-h2 tabular-nums">{value}</p>

      )}

      <p className="mt-1 text-caption text-text-secondary">{label}</p>

    </Card>

  );

}



export default function HomePage() {

  const user = useCurrentUser()!;

  const isAdmin = user.role === 'admin';



  const {

    data: lessons,

    isLoading: lessonsLoading,

    error: lessonsError,

    refetch: refetchLessons,

  } = useQuery({

    queryKey: ['lessons', 'upcoming', user.id, user.role],

    queryFn: async () => {

      const base = { requesterId: user.id };

      if (user.role === 'teacher') {

        return api.lessons.getLessons({ ...base, teacherId: user.id });

      }

      if (user.role === 'admin') {

        return api.lessons.getLessons(base);

      }

      return api.lessons.getLessons({ ...base, studentId: user.id });

    },

  });



  const { data: directions } = useQuery({

    queryKey: ['directions'],

    queryFn: () => api.lessons.getDirections(),

  });



  const { data: teachers, isLoading: teachersLoading } = useQuery({

    queryKey: ['teachers'],

    queryFn: () => api.lessons.getTeachers(),

  });



  const { data: students, isLoading: studentsLoading } = useQuery({

    queryKey: ['users'],

    queryFn: () => api.users.getAllUsers(),

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



  const today = todayISO();

  const todayLessonCount =

    upcomingLessons?.filter((l) => l.date === today).length ?? 0;

  const upcomingCount = upcomingLessons?.length ?? 0;

  const teacherCount = teachers?.length ?? 0;

  const studentCount = students?.filter((u) => u.role === 'student').length ?? 0;



  const getDirectionName = (id: string) => directions?.find((d) => d.id === id)?.name ?? '';

  const getTeacher = (id: string) =>

    teachers?.find((t) => t.id === id) ?? students?.find((u) => u.id === id && u.role === 'teacher');

  const getStudent = (id: string) => students?.find((u) => u.id === id);



  const greeting = () => {

    const h = new Date().getHours();

    if (h < 12) return 'Доброе утро';

    if (h < 18) return 'Добрый день';

    return 'Добрый вечер';

  };



  const showTeacherInCard = user.role !== 'teacher';

  const showStudentInCard = user.role === 'teacher';

  const showBookCta = can(user, 'lessons:book') && !isAdmin;

  const showAssignmentsBlock = can(user, 'assignments:view-own');
  const showProgressBlock = can(user, 'progress:view-own');



  const retryLessons = () => void refetchLessons();

  const retryEvents = () => void refetchEvents();



  if (isAdmin) {

    return (

      <div className="page-container">

        <header className="mb-6">

          <p className="text-body-sm text-text-muted">{greeting()}</p>

          <h1 className="text-h1">{formatUserName(user)}</h1>

          <p className="mt-1 text-body-sm text-text-secondary">Административный обзор</p>

        </header>



        <section className="mb-6" aria-labelledby="admin-kpi-heading">

          <h2 id="admin-kpi-heading" className="mb-3 text-label uppercase tracking-wide">

            Сегодня

          </h2>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">

            <StatCard

              label="Занятий сегодня"

              value={todayLessonCount}

              loading={lessonsLoading}

            />

            <StatCard

              label="Предстоящих"

              value={upcomingCount}

              loading={lessonsLoading}

            />

            <StatCard

              label="Преподавателей"

              value={teacherCount}

              loading={teachersLoading}

            />

            <StatCard

              label="Учеников"

              value={studentCount}

              loading={studentsLoading}

            />

          </div>

        </section>



        <section className="mb-6" aria-labelledby="admin-next-lesson-heading">

          <h2 id="admin-next-lesson-heading" className="mb-3 text-label uppercase tracking-wide">

            Ближайшее занятие школы

          </h2>

          {lessonsError ? (

            <ErrorState onRetry={retryLessons} />

          ) : lessonsLoading ? (

            <LessonCardSkeleton />

          ) : nextLesson ? (

            <LessonCard

              lesson={nextLesson}

              directionName={getDirectionName(nextLesson.directionId)}

              teacher={getTeacher(nextLesson.teacherId)}

              student={getStudent(nextLesson.studentId)}

              personLabel={getLessonCounterpartyName(

                nextLesson,

                'admin',

                getTeacher(nextLesson.teacherId),

                getStudent(nextLesson.studentId),

              )}

            />

          ) : (

            <EmptyState

              icon={CalendarDays}

              title="Пока нет предстоящих занятий"

              description="Когда появятся запланированные занятия, они отобразятся здесь."

              className="py-8"

            />

          )}

        </section>



        <section className="mb-6" aria-labelledby="admin-next-event-heading">

          <div className="mb-3 flex items-center justify-between">

            <h2 id="admin-next-event-heading" className="text-label uppercase tracking-wide">

              Ближайшее мероприятие

            </h2>

            <Link to="/events" className="text-sm text-brand hover:underline">

              Все

            </Link>

          </div>

          {eventsError ? (

            <ErrorState onRetry={retryEvents} />

          ) : nextEvent ? (

            <Link to={`/events/${nextEvent.id}`}>

              <Card interactive>

                <p className="text-h3">{nextEvent.title}</p>

                <p className="mt-1 text-body-sm text-text-secondary">

                  {formatLessonDateTime(nextEvent.date, nextEvent.startTime)} · {nextEvent.location}

                </p>

              </Card>

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



        <section aria-labelledby="admin-quick-actions-heading">

          <h2 id="admin-quick-actions-heading" className="mb-3 text-label uppercase tracking-wide">

            Быстрые действия

          </h2>

          <div className="grid grid-cols-2 gap-3">

            <Link to="/admin/schedule" className="min-h-11">

              <Card interactive padding="sm" className="h-full text-center">

                <CalendarDays className="mx-auto h-5 w-5 text-brand" aria-hidden />

                <p className="mt-2 text-sm font-medium">Расписание</p>

              </Card>

            </Link>

            <Link to="/admin/users" className="min-h-11">

              <Card interactive padding="sm" className="h-full text-center">

                <Users className="mx-auto h-5 w-5 text-accent" aria-hidden />

                <p className="mt-2 text-sm font-medium">Пользователи</p>

              </Card>

            </Link>

            <Link to="/admin/legal" className="min-h-11">

              <Card interactive padding="sm" className="h-full text-center">

                <FileText className="mx-auto h-5 w-5 text-info" aria-hidden />

                <p className="mt-2 text-sm font-medium">Документы</p>

              </Card>

            </Link>

            <Link to="/admin/events" className="min-h-11">

              <Card interactive padding="sm" className="h-full text-center">

                <PartyPopper className="mx-auto h-5 w-5 text-brand" aria-hidden />

                <p className="mt-2 text-sm font-medium">Мероприятия</p>

              </Card>

            </Link>

            <Link to="/admin/school" className="min-h-11">

              <Card interactive padding="sm" className="h-full text-center">

                <Building2 className="mx-auto h-5 w-5 text-accent" aria-hidden />

                <p className="mt-2 text-sm font-medium">Школа</p>

              </Card>

            </Link>

          </div>

        </section>

      </div>

    );

  }



  return (

    <div className="page-container">

      <header className="mb-6">

        <p className="text-body-sm text-text-muted">{greeting()}</p>

        <h1 className="text-h1">{formatUserName(user)}</h1>

      </header>



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

            <Card interactive>

              <p className="text-h3">{nextEvent.title}</p>

              <p className="mt-1 text-body-sm text-text-secondary">

                {formatLessonDateTime(nextEvent.date, nextEvent.startTime)} · {nextEvent.location}

              </p>

            </Card>

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

      {showProgressBlock && <HomeProgressBlock studentId={user.id} requesterId={user.id} />}



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


