import type { CalendarViewMode } from '@/utils/calendarRanges';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { cn } from '@/utils';

const VIEWS: { value: CalendarViewMode; label: string }[] = [
  { value: 'day', label: 'День' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
];

interface CalendarViewSwitcherProps {
  view: CalendarViewMode;
  onChange: (view: CalendarViewMode) => void;
  className?: string;
}

export function CalendarViewSwitcher({ view, onChange, className }: CalendarViewSwitcherProps) {
  return (
    <SegmentedControl
      className={cn('w-full sm:w-auto', className)}
      aria-label="Режим календаря"
      value={view}
      options={VIEWS}
      onChange={onChange}
    />
  );
}
