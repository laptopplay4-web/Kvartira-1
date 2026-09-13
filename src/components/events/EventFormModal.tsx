import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Trash2 } from 'lucide-react';
import type { EventType, SchoolEvent } from '@/types';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { EVENT_TYPE_LABELS } from '@/services/events/constants';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

const TYPE_OPTIONS: { value: EventType; label: string }[] = (
  Object.entries(EVENT_TYPE_LABELS) as [EventType, string][]
).map(([value, label]) => ({ value, label }));

const EVENT_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const EVENT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

interface EventFormModalProps {
  open: boolean;
  onClose: () => void;
  adminId: string;
  event?: SchoolEvent;
  onSaved: () => void;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });
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
  const [maxParticipants, setMaxParticipants] = useState('');
  const [invitedUserIds, setInvitedUserIds] = useState('');
  const [error, setError] = useState('');

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
    setMaxParticipants(event?.maxParticipants?.toString() ?? '');
    setInvitedUserIds(event?.invitedUserIds?.join(', ') ?? '');
    setError('');
  }, [open, event]);

  const saveMutation = useMutation({
    mutationFn: () => {
      let imageUrl: string | undefined;
      if (imageRemoved) {
        imageUrl = undefined;
      } else if (imageDataUrl) {
        imageUrl = imageDataUrl;
      } else if (isEdit) {
        imageUrl = event?.imageUrl;
      }

      const payload = {
        title,
        description,
        type,
        date,
        startTime,
        endTime: endTime || undefined,
        location,
        imageUrl,
        maxParticipants: maxParticipants ? Number(maxParticipants) : undefined,
        invitedUserIds:
          type === 'invited'
            ? invitedUserIds
                .split(',')
                .map((id) => id.trim())
                .filter(Boolean)
            : undefined,
      };
      return isEdit
        ? api.events.updateEvent(event!.id, payload, adminId)
        : api.events.createEvent(payload, adminId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      onSaved();
      onClose();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить мероприятие');
    },
  });

  async function handleImagePick(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    if (!EVENT_IMAGE_MIME.includes(file.type)) {
      setError('Допустимы JPEG, PNG, WebP или GIF');
      return;
    }
    if (file.size > EVENT_IMAGE_MAX_BYTES) {
      setError('Файл не больше 8 МБ');
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setImageDataUrl(dataUrl);
      setImagePreview(dataUrl);
      setImageRemoved(false);
      setError('');
    } catch {
      setError('Не удалось загрузить изображение');
    }
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
    setError('');
    saveMutation.mutate();
  }

  const formId = 'event-form-modal';

  return (
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
          <p className="mb-2 text-caption text-text-muted">Необязательно · JPEG/PNG/WebP/GIF до 8 МБ</p>
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
          <Input
            label="ID приглашённых"
            hint="Через запятую, например user-student"
            value={invitedUserIds}
            onChange={(e) => setInvitedUserIds(e.target.value)}
            required
          />
        )}
        {error && (
          <p className="text-body-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
