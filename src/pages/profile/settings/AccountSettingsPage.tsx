import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore, useCurrentUser } from '@/stores/authStore';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { validateUpdateProfileInput } from '@/services/profile/validation';
import { maskPhone } from '@/utils';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';

export default function AccountSettingsPage() {
  const user = useCurrentUser()!;
  const updateSessionUser = useAuthStore((s) => s.updateSessionUser);
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();

  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [phone, setPhone] = useState(user.phone);
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [nameSaved, setNameSaved] = useState(false);
  const [phoneSaved, setPhoneSaved] = useState(false);

  useEffect(() => {
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setPhone(user.phone);
  }, [user.firstName, user.lastName, user.phone]);

  const updateNameMutation = useMutation({
    mutationFn: () => api.users.updateProfile(user.id, { firstName, lastName }),
    onSuccess: (updated) => {
      updateSessionUser(updated);
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      setNameError('');
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    },
    onError: (e) => {
      setNameSaved(false);
      setNameError(e instanceof ApiError ? e.message : 'Не удалось сохранить');
    },
  });

  const updatePhoneMutation = useMutation({
    mutationFn: () => api.users.updateProfile(user.id, { phone }),
    onSuccess: (updated) => {
      updateSessionUser(updated);
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      setPhoneError('');
      setPhoneSaved(true);
      setTimeout(() => setPhoneSaved(false), 2000);
    },
    onError: (e) => {
      setPhoneSaved(false);
      setPhoneError(e instanceof ApiError ? e.message : 'Не удалось сохранить');
    },
  });

  const nameMutationDisabled = !isOnline || updateNameMutation.isPending;
  const phoneMutationDisabled = !isOnline || updatePhoneMutation.isPending;
  const nameUnchanged = firstName === user.firstName && lastName === user.lastName;
  const phoneUnchanged = phone === user.phone;

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

  const handleSavePhone = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isOnline) return;
    const validationError = validateUpdateProfileInput({ phone });
    if (validationError) {
      setPhoneError(validationError);
      return;
    }
    setPhoneError('');
    updatePhoneMutation.mutate();
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

        <Card className="space-y-4 p-4">
          <h2 className="text-body-sm font-medium">Телефон</h2>
          <p className="text-caption text-text-muted">Текущий: {maskPhone(user.phone)}</p>
          <form onSubmit={handleSavePhone} className="space-y-3">
            <PhoneInput
              label="Новый номер"
              value={phone}
              onChange={(value) => {
                setPhone(value);
                setPhoneError('');
              }}
              error={phoneError || undefined}
            />
            <Button
              type="submit"
              size="sm"
              disabled={phoneMutationDisabled || phoneUnchanged}
              loading={updatePhoneMutation.isPending}
            >
              {phoneSaved ? 'Сохранено' : 'Сохранить'}
            </Button>
          </form>
        </Card>
      </div>
    </section>
  );
}
