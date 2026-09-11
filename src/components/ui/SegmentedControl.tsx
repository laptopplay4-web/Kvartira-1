import { cn } from '@/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
  'aria-label'?: string;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
  size = 'md',
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex max-w-full overflow-x-auto rounded-xl border border-border-subtle bg-surface-elevated p-1 scrollbar-none',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={option.disabled}
            className={cn(
              'min-h-11 shrink-0 rounded-lg px-3 font-medium transition-colors focus-ring',
              size === 'sm' ? 'min-h-9 px-2.5 text-xs' : 'text-sm',
              selected
                ? 'bg-brand-muted text-brand shadow-sm'
                : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
              option.disabled && 'opacity-50',
            )}
            onClick={() => {
              if (!option.disabled) onChange(option.value);
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
