import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { SLOT_INTERVAL_OPTIONS } from '@/services/availability/validateAvailability';
import type { SlotInterval } from '@/types';
import { cn } from '@/utils';

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
    <Modal open={open} onClose={onClose} title="Интервал между занятиями">
      <p className="mb-4 text-body-sm text-text-secondary">
        Минимальный промежуток между началом соседних слотов для записи.
      </p>
      <fieldset>
        <legend className="sr-only">Интервал между занятиями</legend>
        <div className="space-y-2">
          {SLOT_INTERVAL_OPTIONS.map((interval) => (
            <label
              key={interval}
              className={cn(
                'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-4 py-2 transition-colors',
                value === interval
                  ? 'border-brand bg-brand-muted'
                  : 'border-border-subtle hover:border-border',
              )}
            >
              <input
                type="radio"
                name="slotInterval"
                value={interval}
                checked={value === interval}
                onChange={() => onChange(interval)}
                className="h-4 w-4 accent-brand focus-ring"
              />
              <span>{INTERVAL_LABELS[interval]}</span>
            </label>
          ))}
        </div>
        {error && (
          <p className="mt-2 text-caption text-danger" role="alert">
            {error}
          </p>
        )}
      </fieldset>
      <Button className="mt-6" fullWidth onClick={onClose}>
        Готово
      </Button>
    </Modal>
  );
}
