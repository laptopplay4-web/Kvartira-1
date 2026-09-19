import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Film, X } from 'lucide-react';
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
import { VideoPlayer } from '@/components/ui/VideoPlayer';
import {
  ALLOWED_DIRECTIONS_VIDEO_MIMES,
  EMPTY_SCHOOL_SOCIAL_LINKS,
  SCHOOL_SOCIAL_LINK_KEYS,
  SCHOOL_SOCIAL_LINK_LABELS,
} from '@/services/school/constants';
import type { SchoolDirectionsVideo, SchoolSocialLinks } from '@/types';
import { readFileAsDataUrl } from '@/utils/files';

export default function AdminSchoolSettingsPage() {
  const user = useCurrentUser()!;
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [about, setAbout] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [workingHours, setWorkingHours] = useState('');
  const [socialLinks, setSocialLinks] = useState<SchoolSocialLinks>({ ...EMPTY_SCHOOL_SOCIAL_LINKS });
  const [directionsVideo, setDirectionsVideo] = useState<SchoolDirectionsVideo | undefined>();
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const { data, isLoading, error: loadError, refetch } = useQuery({
    queryKey: ['school-settings'],
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
    setSocialLinks({ ...EMPTY_SCHOOL_SOCIAL_LINKS, ...data.socialLinks });
    setDirectionsVideo(data.directionsVideo);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.schoolSettings.updateSchoolSettings(
        {
          name,
          tagline,
          about,
          contacts: { phone, email, address, workingHours },
          socialLinks,
        },
        user.id,
      ),
    onSuccess: (saved) => {
      setError('');
      setSaved(true);
      setSocialLinks({ ...EMPTY_SCHOOL_SOCIAL_LINKS, ...saved.socialLinks });
      setDirectionsVideo(saved.directionsVideo);
      queryClient.setQueryData(['school-settings'], saved);
      void queryClient.invalidateQueries({ queryKey: ['school-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['public'] });
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => {
      setSaved(false);
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить настройки');
    },
  });

  const uploadVideoMutation = useMutation({
    mutationFn: async (file: File) => {
      const dataUrl = await readFileAsDataUrl(file);
      return api.schoolSettings.uploadDirectionsVideo(
        {
          filename: file.name,
          mimeType: file.type || 'video/mp4',
          size: file.size,
          dataUrl,
        },
        user.id,
      );
    },
    onSuccess: (video) => {
      setError('');
      setDirectionsVideo(video);
      void queryClient.invalidateQueries({ queryKey: ['school-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['public'] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить видео');
    },
  });

  const removeVideoMutation = useMutation({
    mutationFn: () => api.schoolSettings.removeDirectionsVideo(user.id),
    onSuccess: (settings) => {
      setError('');
      setDirectionsVideo(settings.directionsVideo);
      void queryClient.invalidateQueries({ queryKey: ['school-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['public'] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Не удалось удалить видео');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isOnline) return;
    setError('');
    saveMutation.mutate();
  }

  function setSocialLink(key: keyof SchoolSocialLinks, value: string) {
    setSocialLinks((prev) => ({ ...prev, [key]: value }));
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

  const busy =
    saveMutation.isPending || uploadVideoMutation.isPending || removeVideoMutation.isPending;

  return (
    <div className="page-container">
      <AdminPageHeader title="Настройки школы" />

      <p className="mb-6 text-body-sm text-text-secondary">
        Информация для окна «О школе» и публичного сайта. Ссылки и видео необязательны.
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

            <div className="space-y-3 border-t border-border-subtle pt-4">
              <h3 className="text-label text-text-primary">Ссылки</h3>
              {SCHOOL_SOCIAL_LINK_KEYS.map((key) => (
                <Input
                  key={key}
                  label={SCHOOL_SOCIAL_LINK_LABELS[key]}
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="https://"
                  value={socialLinks[key]}
                  onChange={(e) => setSocialLink(key, e.target.value)}
                  hint="Можно без https:// — добавится автоматически"
                />
              ))}
            </div>

            <div className="space-y-3 border-t border-border-subtle pt-4">
              <h3 className="text-label text-text-primary">Как добраться</h3>
              <p className="text-caption text-text-muted">Видео MP4 / WebM / MOV, до 100 МБ</p>
              <input
                ref={videoInputRef}
                type="file"
                accept={ALLOWED_DIRECTIONS_VIDEO_MIMES.join(',')}
                className="sr-only"
                disabled={!isOnline || busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) {
                    setError('');
                    uploadVideoMutation.mutate(file);
                  }
                }}
              />
              {directionsVideo ? (
                <div className="space-y-2">
                  <VideoPlayer
                    src={directionsVideo.url}
                    mimeType={directionsVideo.mimeType}
                    className="aspect-video w-full max-h-[min(55vh,26rem)]"
                    aria-label={directionsVideo.filename}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 truncate text-body-sm text-text-secondary">
                      {directionsVideo.filename}
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={!isOnline || busy}
                      onClick={() => videoInputRef.current?.click()}
                    >
                      <Film className="h-4 w-4" aria-hidden />
                      Заменить
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!isOnline || busy}
                      onClick={() => removeVideoMutation.mutate()}
                      aria-label="Удалить видео"
                    >
                      <X className="h-4 w-4" aria-hidden />
                      Удалить
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!isOnline || busy}
                  loading={uploadVideoMutation.isPending}
                  onClick={() => videoInputRef.current?.click()}
                >
                  <Film className="h-4 w-4" aria-hidden />
                  Загрузить видео
                </Button>
              )}
            </div>

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
            <Button
              type="submit"
              className="min-h-11 w-full sm:w-auto"
              loading={saveMutation.isPending}
              disabled={!isOnline || busy}
            >
              Сохранить
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
