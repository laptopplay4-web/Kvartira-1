import { cn } from '@/utils';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
  id?: string;
}

export function Toggle({ checked, onChange, disabled, label, id }: ToggleProps) {
  const toggleId = id ?? label;

  return (
    <button
      type="button"
      role="switch"
      id={toggleId}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-pill transition-colors focus-ring',
        checked ? 'bg-brand' : 'bg-surface-hover',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}
