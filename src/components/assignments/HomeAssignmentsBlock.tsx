import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen } from 'lucide-react';
import { api } from '@/services/api';
import { getRecentAssignmentsForHome } from '@/services/assignments/helpers';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
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
          {recent.map((assignment) => (
            <Link key={assignment.id} to={`/assignments/${assignment.id}`}>
              <Card interactive>
                <h3 className="text-h3">{assignment.title}</h3>
                <div className="mt-2 flex flex-wrap gap-3 text-caption text-text-muted">
                  {getTeacherName(assignment.teacherId) && (
                    <span>{getTeacherName(assignment.teacherId)}</span>
                  )}
                </div>
              </Card>
            </Link>
          ))}
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
