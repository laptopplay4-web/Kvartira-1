import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils';

interface CalendarNavProps {
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  title: string;
  className?: string;
}

export function CalendarNav({ onPrev, onNext, onToday, title, className }: CalendarNavProps) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      <h2 className="text-h3 capitalize">{title}</h2>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onPrev}
          aria-label="Предыдущий период"
          className="min-h-11 min-w-11"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onToday}
          className="min-h-11 px-4"
        >
          Сегодня
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onNext}
          aria-label="Следующий период"
          className="min-h-11 min-w-11"
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
