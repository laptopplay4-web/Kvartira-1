import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Music2, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { useCurrentUser } from '@/stores/authStore';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { AdminPageHeader } from '@/components/ui/AdminPageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { DirectionFormModal } from '@/components/directions/DirectionFormModal';
import type { Direction } from '@/types';

export default function AdminDirectionsPage() {
  const user = useCurrentUser()!;
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const [editing, setEditing] = useState<Direction | undefined>();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Direction | undefined>();
  const [deleteError, setDeleteError] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['directions'],
    queryFn: () => api.lessons.getDirections(),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['directions'] });
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.lessons.deleteDirection(id, user.id),
    onSuccess: () => {
      setDeleting(undefined);
      setDeleteError('');
      invalidate();
    },
    onError: (e) => {
      setDeleteError(e instanceof ApiError ? e.message : 'Не удалось удалить');
    },
  });

  if (error) {
    return (
      <div className="page-container">
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="page-container max-w-lg">
      <AdminPageHeader title="Направления" />

      {!isOnline && (
        <p role="alert" className="mb-3 text-body-sm text-warning">
          {OFFLINE_NETWORK_MESSAGE}
        </p>
      )}

      <div className="mb-4 flex justify-end">
        <Button
          size="sm"
          disabled={!isOnline}
          onClick={() => setCreating(true)}
          className="min-h-11"
        >
          <Plus className="mr-1.5 h-4 w-4" aria-hidden />
          Добавить
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : data?.length === 0 ? (
        <EmptyState
          icon={Music2}
          title="Нет направлений"
          description="Создайте первое направление"
          className="py-8"
        />
      ) : (
        <div className="space-y-2">
          {data?.map((d) => (
            <Card key={d.id} className="flex items-start gap-3 p-4">
              <span className="text-2xl" aria-hidden>
                {d.icon ?? '🎵'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{d.name}</p>
                {d.description && (
                  <p className="mt-1 text-body-sm text-text-secondary">{d.description}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  aria-label={`Редактировать ${d.name}`}
                  disabled={!isOnline}
                  className="min-h-11 min-w-11 rounded-lg p-2 text-text-muted hover:text-brand focus-ring disabled:opacity-50"
                  onClick={() => setEditing(d)}
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`Удалить ${d.name}`}
                  disabled={!isOnline}
                  className="min-h-11 min-w-11 rounded-lg p-2 text-text-muted hover:text-danger focus-ring disabled:opacity-50"
                  onClick={() => {
                    setDeleteError('');
                    setDeleting(d);
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <DirectionFormModal
          open={creating || !!editing}
          onClose={() => {
            setCreating(false);
            setEditing(undefined);
          }}
          adminId={user.id}
          direction={editing}
          onSaved={invalidate}
        />
      )}

      {deleting && (
        <ConfirmDialog
          open={!!deleting}
          onClose={() => setDeleting(undefined)}
          title="Удалить направление?"
          description={
            <>
              <p>
                «{deleting.name}» будет удалено из каталога. Нельзя удалить, если есть занятия или
                пользователи с этим направлением.
              </p>
              {deleteError && (
                <p className="mt-3 text-caption text-danger" role="alert">
                  {deleteError}
                </p>
              )}
            </>
          }
          confirmLabel="Удалить"
          tone="destructive"
          loading={deleteMutation.isPending}
          disabled={!isOnline}
          onConfirm={() => deleteMutation.mutate(deleting.id)}
        />
      )}
    </div>
  );
}
