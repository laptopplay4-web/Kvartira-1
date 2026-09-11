import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useAuthStore, useCurrentUser } from '@/stores/authStore';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { useOwnPhone } from '@/hooks/useOwnPhone';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { validateUpdateProfileInput } from '@/services/profile/validation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';

export default function AccountSettingsPage() {
  const user = useCurrentUser()!;
  const navigate = useNavigate();
  const updateSessionUser = useAuthStore((s) => s.updateSessionUser);
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const { display: phoneDisplay } = useOwnPhone(user.id);

  const [firstName, setFirstName] = useState(user.firstName ?? '');
  const [lastName, setLastName] = useState(user.lastName ?? '');
  const [nameError, setNameError] = useState('');
  const [nameSaved, setNameSaved] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    setFirstName(user.firstName ?? '');
    setLastName(user.lastName ?? '');
  }, [user.firstName, user.lastName]);

  const updateNameMutation = useMutation({
    mutationFn: () => api.users.updateProfile(user.id, { firstName, lastName }),
    onSuccess: (updated) => {
      updateSessionUser({ ...updated, phone: updated.phone || user.phone });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      void queryClient.invalidateQueries({ queryKey: ['users', 'me', user.id] });
      setNameError('');
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    },
    onError: (e) => {
      setNameSaved(false);
      setNameError(e instanceof ApiError ? e.message : 'Не удалось сохранить');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.users.deleteOwnAccount(user.id),
    onSuccess: async () => {
      setDeleteOpen(false);
      await logout();
      navigate('/login', { replace: true });
    },
    onError: (e) => {
      setDeleteError(e instanceof ApiError ? e.message : 'Не удалось удалить аккаунт');
    },
  });

  const nameMutationDisabled = !isOnline || updateNameMutation.isPending;
  const nameUnchanged = firstName === user.firstName && lastName === user.lastName;

  const handleSaveName = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isOnline) return;
    const validationError = validateUpdateProfileInput({ firstName, lastName });
    if (validationError) {
      setNameError(validationError);
      return;
    }
    setNameError('');
    updateNameMutation.mutate();
  };

  return (
    <section>
      {!isOnline && (
        <p role="alert" className="mb-3 text-body-sm text-warning">
          {OFFLINE_NETWORK_MESSAGE}
        </p>
      )}

      <div className="space-y-4">
        <Card className="space-y-4 p-4">
          <h2 className="text-body-sm font-medium">Имя и фамилия</h2>
          <form onSubmit={handleSaveName} className="space-y-3">
            <Input
              label="Имя"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                setNameError('');
              }}
              error={nameError && nameError.includes('Имя') ? nameError : undefined}
              autoComplete="given-name"
            />
            <Input
              label="Фамилия"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                setNameError('');
              }}
              error={nameError && nameError.includes('Фамилия') ? nameError : undefined}
              autoComplete="family-name"
            />
            {nameError && !nameError.includes('Имя') && !nameError.includes('Фамилия') && (
              <p className="text-caption text-danger" role="alert">
                {nameError}
              </p>
            )}
            <Button
              type="submit"
              size="sm"
              disabled={nameMutationDisabled || nameUnchanged}
              loading={updateNameMutation.isPending}
            >
              {nameSaved ? 'Сохранено' : 'Сохранить'}
            </Button>
          </form>
        </Card>

        <Card className="space-y-2 p-4">
          <h2 className="text-body-sm font-medium">Телефон</h2>
          <p className="text-body-sm">{phoneDisplay}</p>
          <p className="text-caption text-text-muted">
            Номер задаётся при регистрации. Изменить его в приложении нельзя.
          </p>
        </Card>

        <Card className="space-y-3 border-danger/20 p-4">
          <h2 className="text-body-sm font-medium text-danger">Удаление аккаунта</h2>
          <p className="text-caption text-text-muted">
            Аккаунт и связанные данные будут удалены безвозвратно. Журнал согласий и служебные записи,
            которые закон требует хранить, могут остаться без привязки к имени.
          </p>
          {deleteError && (
            <p className="text-caption text-danger" role="alert">
              {deleteError}
            </p>
          )}
          <Button
            variant="destructive"
            fullWidth
            disabled={!isOnline || deleteMutation.isPending}
            onClick={() => {
              setDeleteError('');
              setDeleteOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Удалить аккаунт
          </Button>
        </Card>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Удалить аккаунт?"
        description={
          <>
            Аккаунт и связанные данные будут удалены. Журнал согласий и служебные записи, которые
            закон требует хранить, могут остаться без привязки к имени. Это действие нельзя отменить.
          </>
        }
        confirmLabel="Удалить навсегда"
        tone="destructive"
        loading={deleteMutation.isPending}
        disabled={!isOnline}
        onConfirm={() => {
          if (!isOnline) return;
          deleteMutation.mutate();
        }}
      />
    </section>
  );
}
