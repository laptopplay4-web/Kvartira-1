import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { Direction } from '@/types';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { DirectionIconPicker } from '@/components/directions/DirectionIconPicker';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

interface DirectionFormModalProps {
  open: boolean;
  onClose: () => void;
  adminId: string;
  direction?: Direction;
  onSaved: () => void;
}

export function DirectionFormModal({
  open,
  onClose,
  adminId,
  direction,
  onSaved,
}: DirectionFormModalProps) {
  const isOnline = useOnlineStatus();
  const isEdit = !!direction;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(direction?.name ?? '');
    setDescription(direction?.description ?? '');
    setIcon(direction?.icon ?? '');
    setError('');
  }, [open, direction]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        description: description.trim() || undefined,
        icon: icon.trim() || undefined,
      };
      if (isEdit) {
        return api.lessons.updateDirection(direction!.id, payload, adminId);
      }
      return api.lessons.createDirection(payload, adminId);
    },
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (e) => {
      setError(e instanceof ApiError ? e.message : 'Не удалось сохранить');
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Редактировать направление' : 'Новое направление'}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="submit"
            form="direction-form-modal"
            loading={mutation.isPending}
            disabled={!isOnline || !name.trim()}
          >
            {isEdit ? 'Сохранить' : 'Создать'}
          </Button>
        </div>
      }
    >
      {!isOnline && (
        <p role="alert" className="mb-3 text-body-sm text-warning">
          {OFFLINE_NETWORK_MESSAGE}
        </p>
      )}
      <form
        id="direction-form-modal"
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!isOnline) return;
          setError('');
          mutation.mutate();
        }}
      >
        <Input
          label="Название"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
        <Input
          label="Описание"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <DirectionIconPicker
          value={icon}
          onChange={setIcon}
          disabled={!isOnline || mutation.isPending}
        />
        {error && (
          <p className="text-caption text-danger" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
