import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/utils';

interface CalendarNavProps {
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  title: string;
  /** When true, title is not "current period" — click jumps to today. */
  canJumpToToday?: boolean;
  className?: string;
}

export function CalendarNav({
  onPrev,
  onNext,
  onToday,
  title,
  canJumpToToday = false,
  className,
}: CalendarNavProps) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <IconButton label="Предыдущий период" onClick={onPrev}>
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </IconButton>
      {canJumpToToday ? (
        <button
          type="button"
          onClick={onToday}
          className="min-h-11 min-w-0 flex-1 rounded-xl px-2 text-center text-h3 capitalize text-text-primary focus-ring hover:bg-surface-elevated"
          aria-label={`К сегодня: сейчас ${title}`}
        >
          {title}
        </button>
      ) : (
        <p className="min-w-0 flex-1 truncate px-2 text-center text-h3 capitalize" aria-live="polite">
          {title}
        </p>
      )}
      <IconButton label="Следующий период" onClick={onNext}>
        <ChevronRight className="h-5 w-5" aria-hidden />
      </IconButton>
    </div>
  );
}
