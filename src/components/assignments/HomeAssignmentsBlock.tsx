import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen } from 'lucide-react';
import { api } from '@/services/api';
import { getRecentAssignmentsForHome } from '@/services/assignments/helpers';
import { getUnreadAssignmentIds } from '@/services/assignments/unread';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn, formatUserName } from '@/utils';

interface HomeAssignmentsBlockProps {
  studentId: string;
  requesterId: string;
}

export function HomeAssignmentsBlock({ studentId, requesterId }: HomeAssignmentsBlockProps) {
  const {
    data: assignments,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['assignments', studentId, 'student'],
    queryFn: () => api.assignments.getAssignments({ requesterId }),
  });

  const { data: notifications, isFetched: notificationsFetched } = useQuery({
    queryKey: ['notifications', requesterId],
    queryFn: () => api.notifications.getNotifications(requesterId),
  });

  const unreadIds =
    assignments && notificationsFetched
      ? getUnreadAssignmentIds(
          assignments.map((a) => a.id),
          requesterId,
          notifications ?? [],
          new Map(assignments.map((a) => [a.title, a.id])),
          { seed: true },
        )
      : new Set<string>();

  const { data: teachers } = useQuery({
    queryKey: ['teachers'],
    queryFn: () => api.lessons.getTeachers(),
  });

  const recent = assignments ? getRecentAssignmentsForHome(assignments) : [];

  const getTeacherName = (teacherId: string) => {
    const teacher = teachers?.find((t) => t.id === teacherId);
    return teacher ? formatUserName(teacher) : '';
  };

  return (
    <section className="mb-6" aria-labelledby="home-assignments-heading">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="home-assignments-heading" className="text-label uppercase tracking-wide">
          Домашние задания
        </h2>
        <Link to="/assignments" className="text-sm text-brand hover:underline">
          Все
        </Link>
      </div>

      {error ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : recent.length > 0 ? (
        <div className="space-y-3">
          {recent.map((assignment) => {
            const unread = unreadIds.has(assignment.id);
            return (
              <Link key={assignment.id} to={`/assignments/${assignment.id}`}>
                <Card
                  interactive
                  className={cn(
                    unread &&
                      'border-brand/30 bg-brand-muted/30 shadow-[inset_3px_0_0_0_var(--color-brand)]',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className={cn('text-h3', unread && 'text-text-primary')}>
                      {assignment.title}
                    </h3>
                    {unread && (
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand motion-safe:animate-pulse"
                        aria-label="Непрочитано"
                      />
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-caption text-text-muted">
                    {getTeacherName(assignment.teacherId) && (
                      <span>{getTeacherName(assignment.teacherId)}</span>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : assignments ? (
        <EmptyState
          icon={BookOpen}
          title="Нет материалов"
          description="Когда преподаватель опубликует материалы для вашей группы, они появятся здесь"
          className="py-8"
        />
      ) : null}
    </section>
  );
}
