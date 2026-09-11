import type { ReactNode } from 'react';
import { cn } from '@/utils';

interface SelectableTileProps {
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  /** Accessible name when children are not plain text. */
  label?: string;
}

export function SelectableTile({
  selected,
  disabled,
  onClick,
  children,
  className,
  label,
}: SelectableTileProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'w-full rounded-xl border px-4 py-3 text-left transition-[transform,background-color,border-color,box-shadow] duration-[var(--duration-fast)] focus-ring',
        'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
        selected
          ? 'border-brand bg-brand-muted text-brand shadow-sm'
          : 'border-border-subtle bg-surface-elevated text-text-primary hover:bg-surface-hover',
        className,
      )}
    >
      {children}
    </button>
  );
}
