import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Trash2 } from 'lucide-react';
import type { EventType, SchoolEvent } from '@/types';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { EVENT_TYPE_LABELS } from '@/services/events/constants';
import {
  EVENT_IMAGE_MIME,
  validateEventImageFile,
} from '@/services/events/imageCrop';
import { loadImageFromFile } from '@/services/profile/avatar';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EventImageCropModal } from '@/components/events/EventImageCropModal';
import { StudentPickerList } from '@/components/users/StudentPickerList';

const TYPE_OPTIONS: { value: EventType; label: string }[] = (
  Object.entries(EVENT_TYPE_LABELS) as [EventType, string][]
).map(([value, label]) => ({ value, label }));

interface EventFormModalProps {
  open: boolean;
  onClose: () => void;
  adminId: string;
  event?: SchoolEvent;
  onSaved: () => void;
}

export function EventFormModal({ open, onClose, adminId, event, onSaved }: EventFormModalProps) {
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();
  const isEdit = !!event;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<EventType>('concert');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [imagePreview, setImagePreview] = useState<string | undefined>();
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>();
  const [imageRemoved, setImageRemoved] = useState(false);
  const [cropImage, setCropImage] = useState<HTMLImageElement | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState('');
  const [invitedUserIds, setInvitedUserIds] = useState<string[]>([]);
  const [error, setError] = useState('');

  const needsInvitePicker = open && type === 'invited';

  const { data: directions = [] } = useQuery({
    queryKey: ['directions'],
    queryFn: () => api.lessons.getDirections(),
    enabled: needsInvitePicker,
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.users.getAllUsers(adminId),
    enabled: needsInvitePicker,
  });

  const students = useMemo(
    () =>
      users
        .filter((u) => u.role === 'student')
        .sort((a, b) =>
          `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`, 'ru'),
        ),
    [users],
  );

  useEffect(() => {
    if (!open) return;
    setTitle(event?.title ?? '');
    setDescription(event?.description ?? '');
    setType(event?.type ?? 'concert');
    setDate(event?.date ?? '');
    setStartTime(event?.startTime ?? '');
    setEndTime(event?.endTime ?? '');
    setLocation(event?.location ?? '');
    setImagePreview(event?.imageUrl);
    setImageDataUrl(undefined);
    setImageRemoved(false);
    setCropImage(null);
    setCropOpen(false);
    setMaxParticipants(event?.maxParticipants?.toString() ?? '');
    setInvitedUserIds(event?.invitedUserIds ? [...event.invitedUserIds] : []);
    setError('');
  }, [open, event]);

  const saveMutation = useMutation({
    mutationFn: () => {
      // Не отправляем resolved signed URL с карточки: иначе валидация (max 500)
      // и запись поверх pbfile: ломают update. imageUrl — только при смене/удалении.
      const payload: {
        title: string;
        description: string;
        type: EventType;
        date: string;
        startTime: string;
        endTime?: string;
        location: string;
        imageUrl?: string;
        maxParticipants?: number;
        invitedUserIds?: string[];
      } = {
        title,
        description,
        type,
        date,
        startTime,
        endTime: endTime || undefined,
        location,
        maxParticipants: maxParticipants ? Number(maxParticipants) : undefined,
        invitedUserIds: type === 'invited' ? invitedUserIds : undefined,
      };

      if (imageRemoved) {
        payload.imageUrl = undefined;
      } else if (imageDataUrl) {
        payload.imageUrl = imageDataUrl;
      }

      return isEdit
        ? api.events.updateEvent(event!.id, payload, adminId)
        : api.events.createEvent(payload, adminId);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(['event', saved.id], saved);
      queryClient.setQueriesData<SchoolEvent[]>({ queryKey: ['events'] }, (prev) => {
        if (!prev) return [saved];
        const idx = prev.findIndex((item) => item.id === saved.id);
        if (idx === -1) return [saved, ...prev];
        const next = prev.slice();
        next[idx] = saved;
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['events'], refetchType: 'all' });
      onSaved();
      onClose();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить мероприятие');
    },
  });

  async function handleImagePick(fileList: FileList | null) {
    const file = fileList?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    const validation = validateEventImageFile(file);
    if (!validation.valid) {
      setError(validation.message);
      return;
    }

    try {
      const img = await loadImageFromFile(file);
      setCropImage(img);
      setCropOpen(true);
      setError('');
    } catch {
      setError('Не удалось загрузить изображение');
    }
  }

  function handleCropApply(dataUrl: string) {
    setImageDataUrl(dataUrl);
    setImagePreview(dataUrl);
    setImageRemoved(false);
    setCropOpen(false);
    setCropImage(null);
    setError('');
  }

  function handleCropClose() {
    setCropOpen(false);
    setCropImage(null);
  }

  function handleRemoveImage() {
    setImageDataUrl(undefined);
    setImagePreview(undefined);
    setImageRemoved(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isOnline) return;
    if (type === 'invited' && invitedUserIds.length === 0) {
      setError('Выберите хотя бы одного приглашённого участника');
      return;
    }
    setError('');
    saveMutation.mutate();
  }

  const formId = 'event-form-modal';

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={isEdit ? 'Редактировать мероприятие' : 'Новое мероприятие'}
        size="lg"
        footer={
          <div className="flex gap-2">
            <Button type="button" variant="ghost" className="flex-1 min-h-11" onClick={onClose}>
              Отмена
            </Button>
            <Button
              type="submit"
              form={formId}
              className="flex-1 min-h-11"
              loading={saveMutation.isPending}
              disabled={!isOnline}
            >
              {isEdit ? 'Сохранить' : 'Создать'}
            </Button>
          </div>
        }
      >
        <form id={formId} onSubmit={handleSubmit} className="space-y-4">
          {!isOnline && (
            <p className="text-body-sm text-warning" role="alert">
              {OFFLINE_NETWORK_MESSAGE}
            </p>
          )}
          <Input label="Название" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <div>
            <label className="mb-1.5 block text-label text-text-secondary">Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              required
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-body focus-ring"
            />
          </div>
          <div>
            <label htmlFor="event-type" className="mb-1.5 block text-label text-text-secondary">
              Тип
            </label>
            <select
              id="event-type"
              value={type}
              onChange={(e) => setType(e.target.value as EventType)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-body focus-ring min-h-11"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Дата" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            <Input
              label="Начало"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>
          <Input label="Окончание" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          <Input label="Место" value={location} onChange={(e) => setLocation(e.target.value)} required />

          <div>
            <p className="mb-1.5 text-label text-text-secondary">Фото мероприятия</p>
            <p className="mb-2 text-caption text-text-muted">
              Необязательно · JPEG/PNG/WebP/GIF до 8 МБ · после выбора — кадрирование 16:9
            </p>
            {imagePreview ? (
              <div className="relative overflow-hidden rounded-xl">
                <img src={imagePreview} alt="" className="aspect-[16/9] w-full object-cover" />
                <div className="absolute bottom-2 right-2 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Заменить
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={handleRemoveImage}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Удалить
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-elevated text-body-sm text-text-muted transition-colors hover:border-brand hover:text-brand focus-ring"
              >
                <ImagePlus className="h-6 w-6" aria-hidden />
                Прикрепить фото
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={EVENT_IMAGE_MIME.join(',')}
              className="sr-only"
              onChange={(e) => {
                void handleImagePick(e.target.files);
              }}
            />
          </div>

          <Input
            label="Лимит участников"
            type="number"
            min={1}
            hint="Необязательно"
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(e.target.value)}
          />
          {type === 'invited' && (
            <div className="flex min-h-0 flex-col gap-2" data-invalid={invitedUserIds.length === 0 || undefined}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-label text-text-secondary">Приглашённые участники</p>
                {invitedUserIds.length > 0 && (
                  <p className="text-caption text-text-muted">Выбрано: {invitedUserIds.length}</p>
                )}
              </div>
              {usersLoading ? (
                <p className="py-6 text-center text-body-sm text-text-muted">Загрузка учеников…</p>
              ) : (
                <div className="flex min-h-48 max-h-72 flex-col overflow-hidden rounded-xl border border-border bg-surface-elevated/40 p-3">
                  <StudentPickerList
                    students={students}
                    directions={directions}
                    selectedIds={invitedUserIds}
                    onChange={(ids) => {
                      setInvitedUserIds(ids);
                      if (ids.length > 0 && error.startsWith('Выберите хотя бы')) setError('');
                    }}
                    mode="multiple"
                    disabled={!isOnline || saveMutation.isPending}
                    emptyAllLabel="Нет учеников для приглашения"
                    searchPlaceholder="Поиск по имени или фамилии"
                  />
                </div>
              )}
            </div>
          )}
          {error && (
            <p className="text-body-sm text-danger" role="alert">
              {error}
            </p>
          )}
        </form>
      </Modal>

      <EventImageCropModal
        open={cropOpen}
        image={cropImage}
        onClose={handleCropClose}
        onApply={handleCropApply}
      />
    </>
  );
}
