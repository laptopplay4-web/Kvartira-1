import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore, useCurrentUser } from '@/stores/authStore';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { useOwnPhone } from '@/hooks/useOwnPhone';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { validateUpdateProfileInput } from '@/services/profile/validation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

export default function AccountSettingsPage() {
  const user = useCurrentUser()!;
  const updateSessionUser = useAuthStore((s) => s.updateSessionUser);
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const { display: phoneDisplay } = useOwnPhone(user.id);

  const [firstName, setFirstName] = useState(user.firstName ?? '');
  const [lastName, setLastName] = useState(user.lastName ?? '');
  const [nameError, setNameError] = useState('');
  const [nameSaved, setNameSaved] = useState(false);

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
      </div>
    </section>
  );
}
