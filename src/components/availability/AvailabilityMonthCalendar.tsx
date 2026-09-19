import {
  format,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameDay,
  isSameMonth,
  parseISO,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { CalendarNav } from '@/components/calendar/CalendarNav';
import { isDateInPeriod } from '@/services/availability/formHelpers';
import { cn } from '@/utils';

export type AvailabilityCalendarMode = 'period' | 'off-days';

interface AvailabilityMonthCalendarProps {
  anchor: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  periodStart: string | null;
  periodEnd: string | null;
  offDates: string[];
  mode: AvailabilityCalendarMode;
  pendingPeriodStart: string | null;
  onDayClick: (date: string) => void;
}

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function isInPendingRange(
  date: string,
  pendingStart: string | null,
  periodEnd: string | null,
): boolean {
  if (!pendingStart) return false;
  const end = periodEnd && periodEnd >= pendingStart ? periodEnd : pendingStart;
  return date >= pendingStart && date <= end;
}

export function AvailabilityMonthCalendar({
  anchor,
  onPrevMonth,
  onNextMonth,
  onToday,
  periodStart,
  periodEnd,
  offDates,
  mode,
  pendingPeriodStart,
  onDayClick,
}: AvailabilityMonthCalendarProps) {
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const today = new Date();
  const offSet = new Set(offDates);

  const title = format(anchor, 'LLLL yyyy', { locale: ru });
  const canJumpToToday = !isSameMonth(anchor, today);

  return (
    <div>
      <CalendarNav
        title={title}
        canJumpToToday={canJumpToToday}
        onPrev={onPrevMonth}
        onNext={onNextMonth}
        onToday={onToday}
        className="mb-4"
      />

      <div className="mb-2 flex flex-wrap gap-3 text-caption text-text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand/30 ring-1 ring-brand" aria-hidden />
          Период
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-danger-muted ring-1 ring-danger/40" aria-hidden />
          Выходной
        </span>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-1 text-center text-caption text-text-muted">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Календарь графика работы">
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const inMonth = isSameMonth(day, anchor);
          const isToday = isSameDay(day, today);
          const inPeriod = isDateInPeriod(dateStr, periodStart, periodEnd);
          const inPending = isInPendingRange(dateStr, pendingPeriodStart, periodEnd);
          const isOff = offSet.has(dateStr);
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;

          let ariaLabel = format(day, 'd MMMM yyyy', { locale: ru });
          if (inPeriod && isOff) ariaLabel += ', выходной';
          else if (inPeriod) ariaLabel += ', рабочий день';
          if (mode === 'period') ariaLabel += ', выбор периода';

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onDayClick(dateStr)}
              disabled={!inMonth}
              className={cn(
                'relative flex min-h-11 flex-col items-center justify-center rounded-lg p-1 text-sm focus-ring sm:min-h-12',
                !inMonth && 'pointer-events-none opacity-30',
                isToday && 'ring-1 ring-brand',
                inPeriod && !isOff && 'bg-brand/15 ring-1 ring-brand/40',
                (inPending || (mode === 'period' && pendingPeriodStart === dateStr)) &&
                  !inPeriod &&
                  'bg-brand/10 ring-1 ring-brand/30',
                isOff && 'bg-danger-muted ring-1 ring-danger/30 line-through decoration-danger/60',
                !inPeriod && !inPending && inMonth && 'hover:bg-surface-elevated',
                isWeekend && inMonth && !inPeriod && !isOff && 'text-text-secondary',
              )}
              aria-label={ariaLabel}
              aria-pressed={inPeriod && isOff ? true : undefined}
            >
              <span className="tabular-nums">{format(day, 'd')}</span>
              {isOff && (
                <span className="mt-0.5 text-[10px] font-medium text-danger" aria-hidden>
                  вых
                </span>
              )}
            </button>
          );
        })}
      </div>

      {periodStart && periodEnd && (
        <p className="mt-3 text-caption text-text-secondary">
          Период: {format(parseISO(periodStart), 'd MMM', { locale: ru })} —{' '}
          {format(parseISO(periodEnd), 'd MMM yyyy', { locale: ru })}
          {offDates.length > 0 && ` · выходных: ${offDates.length}`}
        </p>
      )}
    </div>
  );
}
