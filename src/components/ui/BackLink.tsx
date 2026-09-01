import { ChevronLeft } from 'lucide-react';
import { useBackNavigation } from '@/hooks/useBackNavigation';
import { cn } from '@/utils';

interface BackLinkProps {
  label: string;
  fallbackTo: string;
  className?: string;
}

const defaultClassName =
  'mb-4 flex min-h-11 items-center gap-1 rounded text-sm text-text-secondary hover:text-brand focus-ring';

export function BackLink({ label, fallbackTo, className }: BackLinkProps) {
  const goBack = useBackNavigation(fallbackTo);

  return (
    <button type="button" onClick={goBack} className={cn(defaultClassName, className)}>
      <ChevronLeft className="h-4 w-4" aria-hidden />
      {label}
    </button>
  );
}
