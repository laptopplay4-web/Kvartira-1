import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore, useCurrentUser } from '@/stores/authStore';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { shouldPromptTeacherDirections } from '@/services/directions/helpers';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { DirectionPicker } from '@/components/directions/DirectionPicker';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';

export function TeacherDirectionsSetupModal() {
  const user = useCurrentUser();
  const updateSessionUser = useAuthStore((s) => s.updateSessionUser);
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const needsSetup = shouldPromptTeacherDirections(user);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    setOpen(needsSetup);
    if (needsSetup && user?.directionIds) {
      setSelected(user.directionIds);
    }
  }, [needsSetup, user?.id, user?.directionIds]);

  const { data: directions = [], isLoading } = useQuery({
    queryKey: ['directions'],
    queryFn: () => api.lessons.getDirections(),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () => api.users.updateProfile(user!.id, { directionIds: selected }),
    onSuccess: (updated) => {
      const withDirections = {
        ...updated,
        phone: updated.phone || user!.phone,
        directionIds: updated.directionIds?.length ? updated.directionIds : selected,
      };
      updateSessionUser(withDirections);
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['teachers'] });
      setOpen(false);
      setError('');
    },
    onError: (e) => {
      setError(e instanceof ApiError ? e.message : 'Не удалось сохранить');
    },
  });

  if (!user || !needsSetup) return null;

  return (
    <Modal
      open={open}
      onClose={() => {}}
      title="Настройте направления"
      dismissible={false}
      footer={
        <Button
          fullWidth
          disabled={!isOnline || selected.length === 0}
          loading={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Сохранить направления
        </Button>
      }
    >
      <div className="mb-3">
        <Badge variant="danger">Срочно</Badge>
      </div>
      <p className="mb-4 text-body-sm text-text-secondary">
        Вы назначены преподавателем. Укажите направления, которые ведёте — иначе ученики не смогут
        записаться.
      </p>
      {!isOnline && (
        <p role="alert" className="mb-3 text-body-sm text-warning">
          {OFFLINE_NETWORK_MESSAGE}
        </p>
      )}
      {isLoading ? (
        <p className="text-body-sm text-text-muted">Загрузка…</p>
      ) : (
        <DirectionPicker
          directions={directions}
          value={selected}
          onChange={setSelected}
          disabled={!isOnline || mutation.isPending}
          error={error}
          hint="Можно выбрать несколько"
        />
      )}
    </Modal>
  );
}
