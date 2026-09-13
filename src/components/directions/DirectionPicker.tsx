import { SelectableTile } from '@/components/ui/SelectableTile';
import type { Direction } from '@/types';
import { cn } from '@/utils';

interface DirectionPickerProps {
  directions: Direction[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  error?: string;
  label?: string;
  hint?: string;
}

export function DirectionPicker({
  directions,
  value,
  onChange,
  disabled,
  error,
  label = 'Направления',
  hint,
}: DirectionPickerProps) {
  const selected = new Set(value);

  function toggle(id: string) {
    if (disabled) return;
    if (selected.has(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  }

  return (
    <fieldset
      className={cn(
        'space-y-2 rounded-xl border p-3 transition-colors',
        error ? 'border-danger' : 'border-transparent',
      )}
      disabled={disabled}
      data-invalid={error ? true : undefined}
      aria-invalid={!!error}
    >
      <legend className="text-body-sm font-medium text-text-primary">{label}</legend>
      {hint && !error && <p className="text-caption text-text-muted">{hint}</p>}
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {directions.map((d) => {
          const isOn = selected.has(d.id);
          return (
            <SelectableTile
              key={d.id}
              selected={isOn}
              disabled={disabled}
              onClick={() => toggle(d.id)}
              className={cn(
                'w-auto min-h-11 px-3 py-2',
                error && !isOn && 'border-danger/60',
              )}
              label={d.name}
            >
              {d.icon ? (
                <span className="mr-1.5" aria-hidden>
                  {d.icon}
                </span>
              ) : null}
              {d.name}
            </SelectableTile>
          );
        })}
      </div>
      {error && (
        <p className="text-caption text-danger" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
