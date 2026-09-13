import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, Users } from 'lucide-react';
import { BackLink } from '@/components/ui/BackLink';
import { useCurrentUser } from '@/stores/authStore';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { useMarkAssignmentViewed } from '@/hooks/useMarkAssignmentViewed';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { canManageAssignment } from '@/services/assignments/access';
import { AssignmentContentView } from '@/components/assignments/AssignmentContentView';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { getAssignmentGroupLabel } from '@/services/assignments/groups/helpers';
import { formatUserName } from '@/utils';
import { UserPreviewTrigger } from '@/components/users/UserPreviewTrigger';

export default function AssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useCurrentUser()!;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useMarkAssignmentViewed(id, user.id);

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

  const deleteMutation = useMutation({
    mutationFn: () => api.assignments.deleteAssignment(id!, user.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
      navigate('/assignments', { replace: true });
    },
    onError: (e) => {
      setDeleteError(e instanceof ApiError ? e.message : 'Не удалось удалить задание');
    },
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

  const groupLabel = groups ? getAssignmentGroupLabel(assignment.groupId, groups) : '—';
  const teacher = teachers?.find((u) => u.id === assignment.teacherId);
  const canManage = canManageAssignment(user);

  return (
    <div className="page-container max-w-lg">
      <BackLink label="К заданиям" fallbackTo="/assignments" />

      <div className="mb-4 flex items-start justify-between gap-3">
        <h1 className="text-h1">{assignment.title}</h1>
        {canManage && (
          <div className="flex shrink-0 gap-2">
            <Link to={`/assignments/${assignment.id}/edit`}>
              <Button size="sm" variant="secondary" disabled={!isOnline}>
                <Pencil className="h-4 w-4" aria-hidden />
                Изменить
              </Button>
            </Link>
            <Button
              size="sm"
              variant="destructive"
              disabled={!isOnline || deleteMutation.isPending}
              onClick={() => {
                setDeleteError('');
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Удалить
            </Button>
          </div>
        )}
      </div>

      {!isOnline && canManage && (
        <p className="mb-4 text-body-sm text-warning" role="alert">
          {OFFLINE_NETWORK_MESSAGE}
        </p>
      )}

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
              <dd>
                <UserPreviewTrigger user={teacher} className="rounded-md p-0 font-medium text-brand">
                  {formatUserName(teacher)}
                </UserPreviewTrigger>
              </dd>
            </div>
          )}
        </dl>
      </Card>

      <AssignmentContentView blocks={assignment.contentBlocks} />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => {
          if (!deleteMutation.isPending) setDeleteOpen(false);
        }}
        title="Удалить задание?"
        description="Задание и материалы будут удалены без возможности восстановления."
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        tone="destructive"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (!isOnline) {
            setDeleteError(OFFLINE_NETWORK_MESSAGE);
            return;
          }
          deleteMutation.mutate();
        }}
      />
      {deleteError && (
        <p className="mt-3 text-caption text-danger" role="alert">
          {deleteError}
        </p>
      )}
    </div>
  );
}
