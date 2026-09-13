import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { SelectableTile } from '@/components/ui/SelectableTile';
import { SLOT_INTERVAL_OPTIONS } from '@/services/availability/validateAvailability';
import type { SlotInterval } from '@/types';

const INTERVAL_LABELS: Record<number, string> = {
  15: '15 минут',
  30: '30 минут',
  40: '40 минут',
  60: '60 минут',
};

interface AvailabilityIntervalModalProps {
  open: boolean;
  onClose: () => void;
  value: SlotInterval;
  onChange: (interval: SlotInterval) => void;
  error?: string;
}

export function AvailabilityIntervalModal({
  open,
  onClose,
  value,
  onChange,
  error,
}: AvailabilityIntervalModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Интервал между занятиями"
      footer={
        <Button fullWidth onClick={onClose}>
          Готово
        </Button>
      }
    >
      <p className="mb-4 text-body-sm text-text-secondary">
        Минимальный промежуток между началом соседних слотов для записи.
      </p>
      <fieldset>
        <legend className="sr-only">Интервал между занятиями</legend>
        <div className="space-y-2" role="radiogroup" aria-label="Интервал между занятиями">
          {SLOT_INTERVAL_OPTIONS.map((interval) => (
            <SelectableTile
              key={interval}
              selected={value === interval}
              onClick={() => onChange(interval)}
              label={INTERVAL_LABELS[interval]}
              className="min-h-11"
            >
              {INTERVAL_LABELS[interval]}
            </SelectableTile>
          ))}
        </div>
        {error && (
          <p className="mt-2 text-caption text-danger" role="alert">
            {error}
          </p>
        )}
      </fieldset>
    </Modal>
  );
}
