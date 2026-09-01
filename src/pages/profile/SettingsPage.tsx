import { useEffect, useState } from 'react';

import { Link } from 'react-router-dom';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { CalendarClock } from 'lucide-react';
import { BackLink } from '@/components/ui/BackLink';

import { useAuthStore, useCurrentUser } from '@/stores/authStore';

import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';

import { can } from '@/permissions';

import { api } from '@/services/api';

import { ApiError } from '@/services/api/types';

import { validateUpdateProfileInput } from '@/services/profile/validation';

import { maskPhone } from '@/utils';

import { PUSH_NOTIFICATIONS_HINT, PUSH_NOTIFICATIONS_LABEL } from '@/services/notifications/constants';
import { useWebPush } from '@/hooks/useWebPush';

import { Button } from '@/components/ui/Button';

import { Card } from '@/components/ui/Card';

import { ErrorState } from '@/components/ui/ErrorState';

import { Input } from '@/components/ui/Input';

import { Skeleton } from '@/components/ui/Skeleton';

import { Toggle } from '@/components/ui/Toggle';

import { AvatarUpload } from '@/components/profile/AvatarUpload';

import { useAvatarMutations } from '@/hooks/useAvatarMutations';
import { useThemePreference } from '@/hooks/useThemePreference';
import { THEME_OPTIONS } from '@/services/theme/constants';

export default function SettingsPage() {

  const user = useCurrentUser()!;

  const updateSessionUser = useAuthStore((s) => s.updateSessionUser);

  const queryClient = useQueryClient();

  const isOnline = useOnlineStatus();

  const showAvailability = can(user, 'availability:manage') && user.role === 'teacher';

  const showSecurity = can(user, 'security:view-own');



  const [firstName, setFirstName] = useState(user.firstName);

  const [lastName, setLastName] = useState(user.lastName);

  const [phone, setPhone] = useState(user.phone);

  const [nameError, setNameError] = useState('');

  const [phoneError, setPhoneError] = useState('');

  const [nameSaved, setNameSaved] = useState(false);

  const [phoneSaved, setPhoneSaved] = useState(false);

  const { avatarError, uploadAvatarMutation, removeAvatarMutation } = useAvatarMutations(user.id);
  const { preference: themePreference, setPreference: setThemePreference } = useThemePreference();

  useEffect(() => {

    setFirstName(user.firstName);

    setLastName(user.lastName);

    setPhone(user.phone);

  }, [user.firstName, user.lastName, user.phone]);

  const {

    data: preferences,

    isLoading,

    error,

    refetch,

  } = useQuery({

    queryKey: ['notification-preferences', user.id],

    queryFn: () => api.notifications.getPreferences(user.id),

  });



  const updatePreferencesMutation = useMutation({

    mutationFn: (pushEnabled: boolean) => api.notifications.updatePreferences(user.id, { pushEnabled }),

    onSuccess: () => {

      void queryClient.invalidateQueries({ queryKey: ['notification-preferences', user.id] });

    },

  });



  const { state: webPushState, error: webPushError, busy: webPushBusy, enablePush, disablePush } =
    useWebPush({
      userId: user.id,
      pushEnabled: preferences?.pushEnabled,
      isOnline,
    });



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



  const toggleDisabled = !isOnline || updatePreferencesMutation.isPending || webPushBusy;

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

    <div className="page-container max-w-lg">

      <BackLink label="Профиль" fallbackTo="/profile" className="mb-4 flex items-center gap-1 text-sm focus-ring rounded" />

      <h1 className="text-h1 mb-6">Настройки</h1>

      <section className="mb-6">
        <h2 className="mb-3 text-label">Оформление</h2>
        <Card className="space-y-3">
          <p className="text-body-sm text-text-secondary">Тема интерфейса</p>
          <div className="flex flex-wrap gap-2">
            {THEME_OPTIONS.map(({ value, label }) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={themePreference === value ? 'primary' : 'secondary'}
                onClick={() => setThemePreference(value)}
                aria-pressed={themePreference === value}
              >
                {label}
              </Button>
            ))}
          </div>
        </Card>
      </section>



      {showAvailability && (

        <section className="mb-6">

          <h2 className="mb-3 text-label">График работы</h2>

          <Link to="/profile/availability">

            <Card interactive className="flex items-center gap-3">

              <CalendarClock className="h-5 w-5 text-text-muted" aria-hidden />

              <span className="flex-1 font-medium">График работы</span>

            </Card>

          </Link>

        </section>

      )}



      {showSecurity && (

        <section className="mb-6">

          <h2 className="mb-3 text-label">Безопасность</h2>

          <Link to="/profile/security">

            <Card interactive className="flex items-center gap-3">

              <span className="flex-1 font-medium">Пароль и сессии</span>

            </Card>

          </Link>

        </section>

      )}



      <section className="mb-6">

        <h2 className="mb-3 text-label">Аккаунт</h2>

        {!isOnline && (

          <p role="alert" className="mb-3 text-body-sm text-warning">

            {OFFLINE_NETWORK_MESSAGE}

          </p>

        )}

        <div className="space-y-4">

          <Card className="space-y-4 p-4">

            <h3 className="text-body-sm font-medium">Имя и фамилия</h3>

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

            <h3 className="text-body-sm font-medium">Телефон</h3>

            <p className="text-caption text-text-muted">Текущий: {maskPhone(user.phone)}</p>

            <form onSubmit={handleSavePhone} className="space-y-3">

              <Input

                label="Новый номер"

                type="tel"

                value={phone}

                onChange={(e) => {

                  setPhone(e.target.value);

                  setPhoneError('');

                }}

                error={phoneError || undefined}

                hint="Формат: +79XXXXXXXXX"

                autoComplete="tel"

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



          <AvatarUpload

            user={user}

            variant="compact"

            disabled={!isOnline}

            uploading={uploadAvatarMutation.isPending}

            removing={removeAvatarMutation.isPending}

            error={avatarError}

            onUpload={(input) => {

              if (!isOnline) return;

              uploadAvatarMutation.mutate(input);

            }}

            onRemove={() => {

              if (!isOnline) return;

              removeAvatarMutation.mutate();

            }}

          />

        </div>

      </section>



      <section className="mb-6">

        <h2 className="mb-3 text-label">Уведомления</h2>

        {!isOnline && (

          <p role="alert" className="mb-3 text-body-sm text-warning">

            {OFFLINE_NETWORK_MESSAGE}

          </p>

        )}

        {error ? (

          <ErrorState onRetry={() => refetch()} />

        ) : isLoading ? (

          <Skeleton className="h-12" />

        ) : preferences ? (

          <Card className="flex items-center justify-between gap-3 px-4 py-3">

            <div className="min-w-0">

              <p className="text-body-sm">{PUSH_NOTIFICATIONS_LABEL}</p>

              <p className="text-caption text-text-muted">{PUSH_NOTIFICATIONS_HINT}</p>

              {webPushState.supported && !webPushState.configured && (
                <p className="mt-1 text-caption text-text-muted">Push пока не настроен на сервере.</p>
              )}

              {webPushError && (
                <p role="alert" className="mt-1 text-caption text-warning">
                  {webPushError}
                </p>
              )}

            </div>

            <Toggle

              label={PUSH_NOTIFICATIONS_LABEL}

              checked={preferences.pushEnabled}

              disabled={toggleDisabled}

              onChange={async (checked) => {

                if (!isOnline) return;

                if (checked) {
                  const ok = await enablePush();
                  if (!ok) return;
                  updatePreferencesMutation.mutate(true);
                  return;
                }

                updatePreferencesMutation.mutate(false);
                await disablePush();

              }}

            />

          </Card>

        ) : null}

      </section>

    </div>

  );

}

