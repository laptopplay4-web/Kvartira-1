import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
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

interface EventFormModalProps {
  open: boolean;
  onClose: () => void;
  adminId: string;
  event?: SchoolEvent;
  onSaved: () => void;
}

export function EventFormModal({ open, onClose, adminId, event, onSaved }: EventFormModalProps) {
  const isOnline = useOnlineStatus();
  const isEdit = !!event;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<EventType>('concert');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [imageUrl, setImageUrl] = useState('');
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
    setImageUrl(event?.imageUrl ?? '');
    setMaxParticipants(event?.maxParticipants?.toString() ?? '');
    setInvitedUserIds(event?.invitedUserIds?.join(', ') ?? '');
    setError('');
  }, [open, event]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        title,
        description,
        type,
        date,
        startTime,
        endTime: endTime || undefined,
        location,
        imageUrl: imageUrl || undefined,
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
      onSaved();
      onClose();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить мероприятие');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isOnline) return;
    setError('');
    saveMutation.mutate();
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Редактировать мероприятие' : 'Новое мероприятие'}>
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
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
        <Input
          label="Ссылка на изображение"
          hint="Необязательно"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
        />
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
        <div className="flex gap-2">
          <Button type="button" variant="ghost" className="flex-1 min-h-11" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" className="flex-1 min-h-11" loading={saveMutation.isPending} disabled={!isOnline}>
            {isEdit ? 'Сохранить' : 'Создать'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
