import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { useCurrentUser } from '@/stores/authStore';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { AdminPageHeader } from '@/components/ui/AdminPageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';

export default function AdminSchoolSettingsPage() {
  const user = useCurrentUser()!;
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [about, setAbout] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [workingHours, setWorkingHours] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const { data, isLoading, error: loadError, refetch } = useQuery({
    queryKey: ['school-settings', user.id],
    queryFn: () => api.schoolSettings.getSchoolSettings(user.id),
  });

  useEffect(() => {
    if (!data) return;
    setName(data.name);
    setTagline(data.tagline);
    setAbout(data.about);
    setPhone(data.contacts.phone);
    setEmail(data.contacts.email);
    setAddress(data.contacts.address);
    setWorkingHours(data.contacts.workingHours);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.schoolSettings.updateSchoolSettings(
        {
          name,
          tagline,
          about,
          contacts: { phone, email, address, workingHours },
        },
        user.id,
      ),
    onSuccess: () => {
      setError('');
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ['school-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['public'] });
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => {
      setSaved(false);
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить настройки');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isOnline) return;
    setError('');
    saveMutation.mutate();
  }

  if (loadError) {
    return (
      <div className="page-container">
        <ErrorState
          message={loadError instanceof ApiError ? loadError.message : undefined}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="page-container">
      <AdminPageHeader title="Настройки школы" />

      <p className="mb-6 text-body-sm text-text-secondary">
        Базовая информация для главной страницы и контактов. Изменения сразу видны на публичном сайте.
      </p>

      {isLoading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <Card className="p-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isOnline && (
              <p className="text-body-sm text-warning" role="alert">
                {OFFLINE_NETWORK_MESSAGE}
              </p>
            )}
            <Input label="Название" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input label="Слоган" value={tagline} onChange={(e) => setTagline(e.target.value)} required />
            <div>
              <label className="mb-1.5 block text-label text-text-secondary">О школе</label>
              <textarea
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                rows={5}
                required
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-body focus-ring"
              />
            </div>
            <Input label="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input label="Адрес" value={address} onChange={(e) => setAddress(e.target.value)} required />
            <Input
              label="Часы работы"
              value={workingHours}
              onChange={(e) => setWorkingHours(e.target.value)}
              required
            />
            {error && (
              <p className="text-body-sm text-danger" role="alert">
                {error}
              </p>
            )}
            {saved && (
              <p className="text-body-sm text-success" role="status">
                Настройки сохранены
              </p>
            )}
            <Button type="submit" className="min-h-11 w-full sm:w-auto" loading={saveMutation.isPending} disabled={!isOnline}>
              Сохранить
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
