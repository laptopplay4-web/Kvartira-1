import {
  format,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameDay,
  isSameMonth,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Lesson } from '@/types';
import { groupLessonsByDate } from '@/services/calendar/helpers';
import { cn } from '@/utils';

interface MonthViewProps {
  anchor: Date;
  lessons: Lesson[];
  onDayClick?: (date: string) => void;
}

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function MonthView({ anchor, lessons, onDayClick }: MonthViewProps) {
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const byDate = groupLessonsByDate(lessons);
  const today = new Date();

  return (
    <div>
      <div className="mb-2 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-1 text-center text-caption text-text-muted">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Календарь месяца">
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const count = byDate.get(dateStr)?.length ?? 0;
          const inMonth = isSameMonth(day, anchor);
          const isToday = isSameDay(day, today);

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onDayClick?.(dateStr)}
              className={cn(
                'flex min-h-11 flex-col items-center justify-center rounded-lg p-1 text-sm focus-ring sm:min-h-14',
                !inMonth && 'opacity-40',
                isToday
                  ? 'border border-brand bg-brand-muted/40 font-semibold'
                  : 'border border-transparent hover:bg-surface-elevated',
                count > 0 && !isToday && 'bg-surface-elevated',
              )}
              aria-label={`${format(day, 'd MMMM', { locale: ru })}${count ? `, ${count} занятий` : ''}`}
            >
              <span className="tabular-nums">{format(day, 'd')}</span>
              {count > 0 && (
                <span className="mt-0.5 flex items-center gap-0.5 text-[10px] text-brand">
                  <span aria-hidden>●</span>
                  <span>{count}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
