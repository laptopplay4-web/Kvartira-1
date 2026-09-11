import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
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
        <IconButton label="Предыдущий период" onClick={onPrev}>
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </IconButton>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onToday}
          className="min-h-11 px-4"
        >
          Сегодня
        </Button>
        <IconButton label="Следующий период" onClick={onNext}>
          <ChevronRight className="h-5 w-5" aria-hidden />
        </IconButton>
      </div>
    </div>
  );
}
