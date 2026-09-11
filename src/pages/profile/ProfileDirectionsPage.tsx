import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Music2 } from 'lucide-react';
import { useAuthStore, useCurrentUser } from '@/stores/authStore';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { actsAsTeacher } from '@/permissions';
import { DirectionPicker } from '@/components/directions/DirectionPicker';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';

export default function ProfileDirectionsPage() {
  const user = useCurrentUser()!;
  const updateSessionUser = useAuthStore((s) => s.updateSessionUser);
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();

  const canEdit = user.role === 'student' || actsAsTeacher(user.role);
  const [directionIds, setDirectionIds] = useState<string[]>(user.directionIds ?? []);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDirectionIds(user.directionIds ?? []);
  }, [user.directionIds]);

  const {
    data: directions = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['directions'],
    queryFn: () => api.lessons.getDirections(),
    enabled: canEdit,
  });

  const mutation = useMutation({
    mutationFn: () => api.users.updateProfile(user.id, { directionIds }),
    onSuccess: (updated) => {
      updateSessionUser({ ...updated, phone: updated.phone || user.phone });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      void queryClient.invalidateQueries({ queryKey: ['teachers'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setError('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (e) => {
      setSaved(false);
      setError(e instanceof ApiError ? e.message : 'Не удалось сохранить');
    },
  });

  if (!canEdit) {
    return <Navigate to="/profile" replace />;
  }

  const unchanged =
    JSON.stringify([...(user.directionIds ?? [])].sort()) ===
    JSON.stringify([...directionIds].sort());

  const label = user.role === 'student' ? 'Направления обучения' : 'Направления преподавания';
  const hint =
    user.role === 'student'
      ? 'Можно добавить новое направление, если перешли в другую группу'
      : 'Можно добавить направление после повышения квалификации';

  return (
    <div className="page-container max-w-lg">
      <BackLink label="Профиль" fallbackTo="/profile" />
      <h1 className="text-h1 mb-2">Направления</h1>
      <p className="mb-6 text-body-sm text-text-secondary">{hint}</p>

      {!isOnline && (
        <p role="alert" className="mb-3 text-body-sm text-warning">
          {OFFLINE_NETWORK_MESSAGE}
        </p>
      )}

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : directions.length === 0 ? (
        <EmptyState
          icon={Music2}
          title="Нет направлений"
          description="Обратитесь к администратору школы"
          className="py-8"
        />
      ) : (
        <Card className="space-y-4 p-4">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!isOnline) return;
              if (directionIds.length === 0) {
                setError('Выберите хотя бы одно направление');
                return;
              }
              setError('');
              mutation.mutate();
            }}
          >
            <DirectionPicker
              directions={directions}
              value={directionIds}
              onChange={(ids) => {
                setDirectionIds(ids);
                setError('');
              }}
              disabled={!isOnline || mutation.isPending}
              error={error}
              label={label}
            />
            <Button
              type="submit"
              disabled={!isOnline || mutation.isPending || unchanged || directionIds.length === 0}
              loading={mutation.isPending}
            >
              {saved ? 'Сохранено' : 'Сохранить'}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
