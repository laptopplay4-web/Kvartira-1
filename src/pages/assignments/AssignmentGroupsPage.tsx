import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Users } from 'lucide-react';
import { BackLink } from '@/components/ui/BackLink';
import { useCurrentUser } from '@/stores/authStore';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { canManageAssignmentGroups } from '@/services/assignments/groups/access';
import { isManagedAssignmentGroup } from '@/services/assignments/groups/helpers';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import type { AssignmentGroup } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Skeleton } from '@/components/ui/Skeleton';

export default function AssignmentGroupsPage() {
  const user = useCurrentUser()!;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [createError, setCreateError] = useState('');
  const [groupToDelete, setGroupToDelete] = useState<AssignmentGroup | null>(null);

  const { data: groups, isLoading, error, refetch } = useQuery({
    queryKey: ['assignment-groups', user.id],
    queryFn: () => api.assignmentGroups.getGroups(user.id),
  });

  const createMutation = useMutation({
    mutationFn: () => api.assignmentGroups.createGroup({ name: name.trim() }, user.id),
    onSuccess: (group) => {
      setName('');
      setCreateError('');
      setCreateModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['assignment-groups'] });
      navigate(`/assignments/groups/${group.id}`);
    },
    onError: (e) => {
      setCreateError(e instanceof ApiError ? e.message : 'Не удалось создать группу');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (groupId: string) => api.assignmentGroups.deleteGroup(groupId, user.id),
    onSuccess: () => {
      setGroupToDelete(null);
      void queryClient.invalidateQueries({ queryKey: ['assignment-groups'] });
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
  });

  const openCreateModal = () => {
    setName('');
    setCreateError('');
    setCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    if (createMutation.isPending) return;
    setCreateModalOpen(false);
    setName('');
    setCreateError('');
  };

  const closeDeleteModal = () => {
    if (deleteMutation.isPending) return;
    setGroupToDelete(null);
  };

  if (!canManageAssignmentGroups(user)) {
    return <Navigate to="/assignments" replace />;
  }

  const customGroups = groups?.filter(isManagedAssignmentGroup) ?? [];

  return (
    <div className="page-container max-w-lg">
      <BackLink label="К заданиям" fallbackTo="/assignments" />

      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-h1 mb-1">Группы</h1>
          <p className="text-body-sm text-text-secondary">
            Создавайте группы и назначайте разный материал для каждой
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          disabled={!isOnline}
          onClick={openCreateModal}
          aria-label="Создать группу"
        >
          <Plus className="h-5 w-5" aria-hidden />
        </Button>
      </div>

      {!isOnline && (
        <p className="mb-4 text-body-sm text-warning" role="alert">
          {OFFLINE_NETWORK_MESSAGE}
        </p>
      )}

      {error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <Skeleton className="h-24" />
      ) : customGroups.length > 0 ? (
        <ul className="space-y-3">
          {customGroups.map((group) => (
            <li key={group.id}>
              <Card className="flex items-stretch gap-0 overflow-hidden !p-0 transition-colors duration-200">
                <Link
                  to={`/assignments/groups/${group.id}`}
                  className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-surface-hover"
                >
                  <div className="min-w-0">
                    <h2 className="truncate font-medium">{group.name}</h2>
                    <p className="text-caption text-text-muted">
                      {group.memberIds.length} участников
                    </p>
                  </div>
                  <Users className="h-5 w-5 shrink-0 text-text-muted" aria-hidden />
                </Link>
                <div className="flex items-center border-l border-border px-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="min-h-11 min-w-11 text-danger hover:bg-danger-muted hover:text-danger"
                    disabled={!isOnline || deleteMutation.isPending}
                    aria-label={`Удалить группу ${group.name}`}
                    onClick={() => {
                      deleteMutation.reset();
                      setGroupToDelete(group);
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Users}
          title="Нет групп"
          description="Создайте первую группу для распределения материалов"
          action={
            <Button type="button" disabled={!isOnline} onClick={openCreateModal}>
              <Plus className="h-4 w-4" aria-hidden />
              Создать группу
            </Button>
          }
        />
      )}

      <Modal
        open={createModalOpen}
        onClose={closeCreateModal}
        title="Новая группа"
        footer={
          <Button
            type="button"
            fullWidth
            loading={createMutation.isPending}
            disabled={!isOnline || name.trim().length < 2}
            onClick={() => createMutation.mutate()}
          >
            Создать
          </Button>
        }
      >
        <div className="space-y-4">
          <Input
            label="Название"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например: Вокалисты"
            disabled={!isOnline || createMutation.isPending}
            autoFocus
          />
          {createError && (
            <p className="text-caption text-danger" role="alert">
              {createError}
            </p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!groupToDelete}
        onClose={closeDeleteModal}
        title="Удалить группу?"
        description={
          <>
            <p>
              «{groupToDelete?.name}» будет удалена без возможности восстановления.
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
        disabled={!isOnline || !groupToDelete}
        onConfirm={() => {
          if (!groupToDelete) return;
          deleteMutation.mutate(groupToDelete.id);
        }}
      />
    </div>
  );
}
