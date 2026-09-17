import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, UserMinus } from 'lucide-react';
import { BackLink } from '@/components/ui/BackLink';
import { useCurrentUser } from '@/stores/authStore';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { isUserAmongMembers, isManagedAssignmentGroup } from '@/services/assignments/groups/helpers';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { AddGroupMembersModal } from '@/components/assignments/AddGroupMembersModal';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { Avatar } from '@/components/ui/Avatar';
import { UserPreviewTrigger } from '@/components/users/UserPreviewTrigger';
import { formatUserName } from '@/utils';
import { sortUsersByRoleAndName } from '@/services/users/helpers';

export default function AssignmentGroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useCurrentUser()!;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actionError, setActionError] = useState('');

  const { data: group, isLoading, error, refetch } = useQuery({
    queryKey: ['assignment-group', id, user.id],
    queryFn: () => api.assignmentGroups.getGroup(id!, user.id),
    enabled: !!id,
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.users.getAllUsers(user.id),
  });

  const { data: directions } = useQuery({
    queryKey: ['directions'],
    queryFn: () => api.lessons.getDirections(),
  });

  const addMembersMutation = useMutation({
    mutationFn: async (studentIds: string[]) => {
      for (const studentId of studentIds) {
        await api.assignmentGroups.addMember(id!, studentId, user.id);
      }
    },
    onSuccess: () => {
      setActionError('');
      void queryClient.invalidateQueries({ queryKey: ['assignment-group', id] });
      void queryClient.invalidateQueries({ queryKey: ['assignment-groups'] });
    },
    onError: (e) => {
      setActionError(e instanceof ApiError ? e.message : 'Не удалось добавить участников');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (studentId: string) =>
      api.assignmentGroups.removeMember(id!, studentId, user.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assignment-group', id] });
      void queryClient.invalidateQueries({ queryKey: ['assignment-groups'] });
    },
    onError: (e) => {
      setActionError(e instanceof ApiError ? e.message : 'Не удалось исключить участника');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.assignmentGroups.deleteGroup(id!, user.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assignment-groups'] });
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
      navigate('/assignments/groups', { replace: true });
    },
  });

  const availableStudents = useMemo(() => {
    if (!users || !group) return [];
    return users
      .filter((u) => u.role === 'student')
      .filter((student) => !isUserAmongMembers(student, group.members));
  }, [users, group]);

  if (isLoading) {
    return (
      <div className="page-container">
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="page-container">
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  if (!group.canManage || !isManagedAssignmentGroup(group)) {
    return <Navigate to="/assignments/groups" replace />;
  }

  const members = sortUsersByRoleAndName(group.members);

  const closeDeleteModal = () => {
    if (deleteMutation.isPending) return;
    setDeleteOpen(false);
  };

  return (
    <div className="page-container max-w-lg">
      <div className="mb-4 flex items-start justify-between gap-3">
        <BackLink label="К группам" fallbackTo="/assignments/groups" className="mb-0" />
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="min-h-11 min-w-11 text-danger hover:text-danger"
          aria-label="Удалить группу"
          disabled={!isOnline || deleteMutation.isPending}
          onClick={() => {
            deleteMutation.reset();
            setDeleteOpen(true);
          }}
        >
          <Trash2 className="h-5 w-5" aria-hidden />
        </Button>
      </div>

      <h1 className="mb-2 text-h1">{group.name}</h1>
      <p className="mb-6 text-body-sm text-text-secondary">
        Управление участниками группы
      </p>

      {!isOnline && (
        <p className="mb-4 text-body-sm text-warning" role="alert">
          {OFFLINE_NETWORK_MESSAGE}
        </p>
      )}

      {actionError && (
        <p className="mb-4 text-caption text-danger" role="alert">
          {actionError}
        </p>
      )}

      <section aria-labelledby="members-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="members-heading" className="text-label uppercase tracking-wide">
            Участники ({members.length})
          </h2>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            disabled={!isOnline || availableStudents.length === 0}
            onClick={() => setAddModalOpen(true)}
            aria-label="Добавить участников"
          >
            <Plus className="h-5 w-5" aria-hidden />
          </Button>
        </div>

        {members.length > 0 ? (
          <ul className="space-y-2">
            {members.map((member) => (
              <li key={member.id}>
                <Card padding="sm" className="flex items-center justify-between gap-3">
                  <UserPreviewTrigger
                    user={member}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-0"
                  >
                    <Avatar
                      src={member.avatarUrl}
                      firstName={member.firstName}
                      lastName={member.lastName}
                      size="sm"
                    />
                    <span className="truncate">{formatUserName(member)}</span>
                  </UserPreviewTrigger>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!isOnline || removeMutation.isPending}
                    onClick={() => removeMutation.mutate(member.id)}
                    aria-label={`Исключить ${formatUserName(member)}`}
                  >
                    <UserMinus className="h-4 w-4 text-danger" aria-hidden />
                    <span className="sr-only sm:not-sr-only sm:ml-1">Исключить</span>
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <Card>
            <p className="text-body-sm text-text-muted">Пока нет участников</p>
          </Card>
        )}
      </section>

      <AddGroupMembersModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        students={availableStudents}
        directions={directions ?? []}
        loading={addMembersMutation.isPending}
        disabled={!isOnline}
        onAdd={async (studentIds) => {
          await addMembersMutation.mutateAsync(studentIds);
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={closeDeleteModal}
        title="Удалить группу?"
        description={
          <>
            <p>
              «{group.name}» будет удалена без возможности восстановления.
              Связанные задания этой группы также будут удалены.
            </p>
            {deleteMutation.error && (
              <p className="mt-2 text-caption text-danger" role="alert">
                {deleteMutation.error instanceof ApiError
                  ? deleteMutation.error.message
                  : 'Не удалось удалить группу'}
              </p>
            )}
          </>
        }
        confirmLabel="Удалить"
        tone="destructive"
        loading={deleteMutation.isPending}
        disabled={!isOnline}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}
