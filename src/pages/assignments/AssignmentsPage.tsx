import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Plus, Users } from 'lucide-react';
import { useCurrentUser } from '@/stores/authStore';
import { api } from '@/services/api';
import { actsAsTeacher, can } from '@/permissions';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { getAssignmentGroupLabel } from '@/services/assignments/groups/helpers';
import { formatUserName } from '@/utils';

export default function AssignmentsPage() {
  const user = useCurrentUser()!;

  const { data: assignments, isLoading, error, refetch } = useQuery({
    queryKey: ['assignments', user.id, user.role],
    queryFn: () => api.assignments.getAssignments({ requesterId: user.id }),
  });

  const { data: groups } = useQuery({
    queryKey: ['assignment-groups', user.id],
    queryFn: () => api.assignmentGroups.getGroups(user.id),
  });

  const { data: teachers } = useQuery({
    queryKey: ['teachers'],
    queryFn: () => api.lessons.getTeachers(),
    enabled: user.role === 'student',
  });

  const getGroupName = (groupId: string) =>
    groups ? getAssignmentGroupLabel(groupId, groups) : '';
  const getTeacherName = (teacherId: string) => {
    const teacher = teachers?.find((u) => u.id === teacherId);
    return teacher ? formatUserName(teacher) : '';
  };

  const subtitle = () => {
    if (user.role === 'student') return 'Материалы от преподавателей по вашим группам';
    if (actsAsTeacher(user.role)) return 'Материалы для ваших групп';
    return 'Все материалы школы';
  };

  const canCreate = can(user, 'assignments:create');
  const canManageGroups = can(user, 'assignments:manage-groups');

  if (error) {
    return (
      <div className="page-container">
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 mb-1">Домашние задания</h1>
          <p className="text-body-sm text-text-secondary">{subtitle()}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {canManageGroups && (
            <Link to="/assignments/groups">
              <Button size="sm" variant="secondary">
                <Users className="h-4 w-4" aria-hidden />
                Группы
              </Button>
            </Link>
          )}
          {canCreate && (
            <Link to="/assignments/create">
              <Button size="sm">
                <Plus className="h-4 w-4" aria-hidden />
                Создать
              </Button>
            </Link>
          )}
        </div>
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
                <h2 className="text-h3">{assignment.title}</h2>
                <p className="mt-1 line-clamp-2 text-body-sm text-text-secondary">
                  {assignment.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-3 text-caption text-text-muted">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" aria-hidden />
                    {getGroupName(assignment.groupId)}
                  </span>
                  {user.role === 'student' && (
                    <span>{getTeacherName(assignment.teacherId)}</span>
                  )}
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
              ? 'Когда преподаватель опубликует материалы для вашей группы, они появятся здесь'
              : 'Создайте группу и добавьте материалы для учеников'
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
