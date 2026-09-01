import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Calendar, Plus } from 'lucide-react';
import { useCurrentUser } from '@/stores/authStore';
import { api } from '@/services/api';
import { can } from '@/permissions';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AssignmentStatusBadge } from '@/components/ui/AssignmentStatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatFullDate } from '@/utils/dates';
import { formatUserName } from '@/utils';

export default function AssignmentsPage() {
  const user = useCurrentUser()!;

  const needsUsers = user.role !== 'student';

  const { data: assignments, isLoading, error, refetch } = useQuery({
    queryKey: ['assignments', user.id, user.role],
    queryFn: () => api.assignments.getAssignments({ requesterId: user.id }),
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.users.getAllUsers(),
    enabled: needsUsers,
  });

  const { data: teachers } = useQuery({
    queryKey: ['teachers'],
    queryFn: () => api.lessons.getTeachers(),
    enabled: user.role === 'student',
  });

  const getPersonName = (id: string, role?: 'teacher' | 'student') => {
    if (role === 'teacher' || user.role === 'student') {
      const teacher = teachers?.find((u) => u.id === id);
      if (teacher) return formatUserName(teacher);
    }
    const person = users?.find((u) => u.id === id);
    return person ? formatUserName(person) : '';
  };

  const subtitle = () => {
    if (user.role === 'student') return 'Ваши задания от преподавателей';
    if (user.role === 'teacher') return 'Задания ваших учеников';
    return 'Все задания школы';
  };

  if (error) {
    return (
      <div className="page-container">
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  const canCreate = can(user, 'assignments:create');

  return (
    <div className="page-container">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 mb-1">Домашние задания</h1>
          <p className="text-body-sm text-text-secondary">{subtitle()}</p>
        </div>
        {canCreate && (
          <Link to="/assignments/create" className="shrink-0">
            <Button size="sm">
              <Plus className="h-4 w-4" aria-hidden />
              Создать
            </Button>
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : assignments && assignments.length > 0 ? (
        <div className="space-y-4">
          {assignments.map((assignment) => (
            <Link key={assignment.id} to={`/assignments/${assignment.id}`}>
              <Card interactive>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <AssignmentStatusBadge assignment={assignment} />
                    <h2 className="mt-2 text-h3">{assignment.title}</h2>
                    <p className="mt-1 line-clamp-2 text-body-sm text-text-secondary">
                      {assignment.description}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3 text-caption text-text-muted">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" aria-hidden />
                        Срок: {formatFullDate(assignment.dueDate)}
                      </span>
                      {user.role === 'teacher' && (
                        <span>{getPersonName(assignment.studentId)}</span>
                      )}
                      {user.role === 'student' && (
                        <span>{getPersonName(assignment.teacherId, 'teacher')}</span>
                      )}
                      {can(user, 'assignments:view-all') && (
                        <span>
                          {getPersonName(assignment.teacherId)} → {getPersonName(assignment.studentId)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title="Нет заданий"
          description={
            user.role === 'student'
              ? 'Когда преподаватель выдаст задание, оно появится здесь'
              : 'Создайте задание для ученика'
          }
          action={
            canCreate ? (
              <Link to="/assignments/create">
                <Button>
                  <Plus className="h-4 w-4" aria-hidden />
                  Создать задание
                </Button>
              </Link>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
