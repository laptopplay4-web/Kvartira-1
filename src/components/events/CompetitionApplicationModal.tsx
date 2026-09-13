import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { COMPETITION_CATEGORY_OPTIONS } from '@/services/events/constants';
import type { CompetitionApplication } from '@/types';

const schema = z.object({
  pieceTitle: z.string().trim().min(1, 'Укажите название произведения'),
  composer: z.string().trim().min(1, 'Укажите композитора'),
  durationMinutes: z.coerce.number().min(1, 'Минимум 1 минута').max(30, 'Максимум 30 минут'),
  category: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface CompetitionApplicationModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (application: CompetitionApplication) => void;
  loading?: boolean;
  error?: string;
  disabled?: boolean;
}

export function CompetitionApplicationModal({
  open,
  onClose,
  onSubmit,
  loading,
  error,
  disabled,
}: CompetitionApplicationModalProps) {
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      pieceTitle: '',
      composer: '',
      durationMinutes: 3,
      category: '',
      notes: '',
    },
  });

  const handleClose = () => {
    setServerError('');
    reset();
    onClose();
  };

  const submit = handleSubmit((data) => {
    setServerError('');
    onSubmit({
      pieceTitle: data.pieceTitle,
      composer: data.composer,
      durationMinutes: data.durationMinutes,
      category: data.category || undefined,
      notes: data.notes || undefined,
    });
  });

  const displayError = error || serverError;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Заявка на конкурс"
      footer={
        <div className="flex gap-3">
          <Button type="button" variant="secondary" fullWidth onClick={handleClose} disabled={loading}>
            Отмена
          </Button>
          <Button type="submit" form="competition-application-form" fullWidth loading={loading} disabled={disabled}>
            Подать заявку
          </Button>
        </div>
      }
    >
      <form id="competition-application-form" className="space-y-4" onSubmit={submit}>
        <Input
          label="Произведение"
          error={errors.pieceTitle?.message}
          disabled={disabled}
          {...register('pieceTitle')}
        />
        <Input
          label="Композитор"
          error={errors.composer?.message}
          disabled={disabled}
          {...register('composer')}
        />
        <Input
          label="Продолжительность (мин)"
          type="number"
          min={1}
          max={30}
          error={errors.durationMinutes?.message}
          disabled={disabled}
          {...register('durationMinutes')}
        />
        <div className="space-y-1.5">
          <label htmlFor="competition-category" className="text-label block">
            Категория
          </label>
          <select
            id="competition-category"
            className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-body text-text-primary focus-ring"
            disabled={disabled}
            {...register('category')}
          >
            <option value="">Не выбрано</option>
            {COMPETITION_CATEGORY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="competition-notes" className="text-label block">
            Комментарий
          </label>
          <textarea
            id="competition-notes"
            rows={3}
            className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-body text-text-primary placeholder:text-text-muted focus-ring"
            placeholder="Дополнительная информация для жюри"
            disabled={disabled}
            {...register('notes')}
          />
        </div>

        {displayError && (
          <p className="text-caption text-danger" role="alert">
            {displayError}
          </p>
        )}
      </form>
    </Modal>
  );
}
