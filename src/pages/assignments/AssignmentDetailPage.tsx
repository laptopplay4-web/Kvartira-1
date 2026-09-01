import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { BackLink } from '@/components/ui/BackLink';
import { useCurrentUser } from '@/stores/authStore';
import { api } from '@/services/api';
import { AssignmentContentView } from '@/components/assignments/AssignmentContentView';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { getAssignmentGroupLabel } from '@/services/assignments/groups/helpers';
import { formatUserName } from '@/utils';

export default function AssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useCurrentUser()!;

  const { data: assignment, isLoading, error, refetch } = useQuery({
    queryKey: ['assignment', id, user.id],
    queryFn: () => api.assignments.getAssignment(id!, user.id),
    enabled: !!id,
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

  if (isLoading) {
    return (
      <div className="page-container">
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="page-container">
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  const groupLabel = groups
    ? getAssignmentGroupLabel(assignment.groupId, groups)
    : '—';
  const teacher = teachers?.find((u) => u.id === assignment.teacherId);

  return (
    <div className="page-container max-w-lg">
      <BackLink label="К заданиям" fallbackTo="/assignments" />

      <h1 className="mb-4 text-h1">{assignment.title}</h1>

      <Card className="mb-4">
        <p className="text-body-sm text-text-secondary">{assignment.description}</p>
        <dl className="mt-4 space-y-2 text-body-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Получатели</dt>
            <dd className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" aria-hidden />
              {groupLabel}
            </dd>
          </div>
          {user.role === 'student' && teacher && (
            <div className="flex justify-between gap-4">
              <dt className="text-text-muted">Преподаватель</dt>
              <dd>{formatUserName(teacher)}</dd>
            </div>
          )}
        </dl>
      </Card>

      <AssignmentContentView blocks={assignment.contentBlocks} />
    </div>
  );
}
