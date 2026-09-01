import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Calendar } from 'lucide-react';
import { api } from '@/services/api';
import { getUpcomingAssignmentsForHome } from '@/services/assignments/helpers';
import { AssignmentStatusBadge } from '@/components/ui/AssignmentStatusBadge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatFullDate } from '@/utils/dates';
import { formatUserName } from '@/utils';

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

  const { data: teachers } = useQuery({
    queryKey: ['teachers'],
    queryFn: () => api.lessons.getTeachers(),
  });

  const pending = assignments ? getUpcomingAssignmentsForHome(assignments) : [];

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
      ) : pending.length > 0 ? (
        <div className="space-y-3">
          {pending.map((assignment) => (
            <Link key={assignment.id} to={`/assignments/${assignment.id}`}>
              <Card interactive>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <AssignmentStatusBadge assignment={assignment} />
                    <h3 className="mt-2 text-h3">{assignment.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-3 text-caption text-text-muted">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" aria-hidden />
                        Срок: {formatFullDate(assignment.dueDate)}
                      </span>
                      {getTeacherName(assignment.teacherId) && (
                        <span>{getTeacherName(assignment.teacherId)}</span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : assignments ? (
        <EmptyState
          icon={BookOpen}
          title="Нет активных заданий"
          description="Когда преподаватель выдаст задание, оно появится здесь"
          className="py-8"
        />
      ) : null}
    </section>
  );
}
