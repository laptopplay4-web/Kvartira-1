import type { CalendarViewMode } from '@/utils/calendarRanges';
import { cn } from '@/utils';

const VIEWS: { id: CalendarViewMode; label: string }[] = [
  { id: 'day', label: 'День' },
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' },
];

interface CalendarViewSwitcherProps {
  view: CalendarViewMode;
  onChange: (view: CalendarViewMode) => void;
  className?: string;
}

export function CalendarViewSwitcher({ view, onChange, className }: CalendarViewSwitcherProps) {
  return (
    <div
      className={cn('flex gap-1 rounded-xl border border-border-subtle bg-surface p-1', className)}
      role="tablist"
      aria-label="Режим календаря"
    >
      {VIEWS.map((v) => (
        <button
          key={v.id}
          type="button"
          role="tab"
          aria-selected={view === v.id}
          onClick={() => onChange(v.id)}
          className={cn(
            'min-h-11 flex-1 rounded-lg px-3 py-2 text-sm font-medium focus-ring sm:flex-none sm:px-4',
            view === v.id ? 'bg-brand-muted text-brand' : 'text-text-muted hover:bg-surface-elevated',
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
