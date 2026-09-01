import { ChevronLeft } from 'lucide-react';
import { useBackNavigation } from '@/hooks/useBackNavigation';
import { cn } from '@/utils';

interface BackLinkProps {
  label: string;
  fallbackTo: string;
  className?: string;
}

/** Secondary outline — distinct from shell nav active highlight. */
export const backNavButtonClassName =
  'inline-flex min-h-11 items-center gap-1 rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2 text-sm font-medium text-text-secondary transition-colors focus-ring hover:border-border hover:bg-surface-hover hover:text-text-primary active:scale-[0.98]';

export const backNavIconButtonClassName =
  'flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-elevated text-text-secondary transition-colors focus-ring hover:border-border hover:bg-surface-hover hover:text-text-primary active:scale-[0.98]';

const defaultClassName = cn('mb-4', backNavButtonClassName);

export function BackLink({ label, fallbackTo, className }: BackLinkProps) {
  const goBack = useBackNavigation(fallbackTo);

  return (
    <button type="button" onClick={goBack} className={cn(defaultClassName, className)}>
      <ChevronLeft className="h-4 w-4" aria-hidden />
      {label}
    </button>
  );
}
