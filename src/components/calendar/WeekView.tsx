import { format, eachDayOfInterval, isSameDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Lesson, User } from '@/types';
import { CalendarLessonList } from './CalendarLessonList';
import { groupLessonsByDate } from '@/services/calendar/helpers';
import { filterLessonsByDateRange, parseCalendarDate } from '@/utils/calendarRanges';
import { cn } from '@/utils';

interface WeekViewProps {
  from: string;
  to: string;
  lessons: Lesson[];
  directions: Map<string, string>;
  teachers: Map<string, User>;
  students: Map<string, User>;
  viewer: User;
  onDayClick?: (date: string) => void;
}

export function WeekView({
  from,
  to,
  lessons,
  directions,
  teachers,
  students,
  viewer,
  onDayClick,
}: WeekViewProps) {
  const days = eachDayOfInterval({
    start: parseCalendarDate(from),
    end: parseCalendarDate(to),
  });
  const byDate = groupLessonsByDate(lessons);
  const today = new Date();
  const weekLessons = filterLessonsByDateRange(lessons, from, to);

  return (
    <div className="space-y-5">
      <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-border-subtle">
        {/* Mobile: scroll days horizontally. Desktop: 7 equal columns — header only (cards in list below). */}
        <div className="scroll-x-contained md:overflow-x-visible">
          <div className="flex w-max min-w-full gap-px bg-border-subtle md:grid md:w-full md:grid-cols-7">
            {days.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const count = byDate.get(dateStr)?.length ?? 0;
              const isToday = isSameDay(day, today);

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => onDayClick?.(dateStr)}
                  className={cn(
                    'flex w-[4.5rem] shrink-0 flex-col items-center justify-center gap-0.5 bg-surface px-1 py-2 text-center focus-ring md:w-auto md:min-w-0 md:min-h-14',
                    isToday && 'bg-brand-muted/30',
                  )}
                  aria-label={`${format(day, 'EEEE d MMMM', { locale: ru })}${count ? `, ${count} занятий` : ''}`}
                >
                  <p className="text-caption capitalize text-text-muted">
                    {format(day, 'EEE', { locale: ru })}
                  </p>
                  <span className="text-lg font-semibold tabular-nums">{format(day, 'd')}</span>
                  {isToday && (
                    <span className="rounded bg-brand/20 px-1.5 py-0.5 text-[10px] font-medium text-brand">
                      сегодня
                    </span>
                  )}
                  {count > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-brand" aria-hidden>
                      <span>●</span>
                      <span>{count}</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <CalendarLessonList
        lessons={weekLessons}
        directions={directions}
        teachers={teachers}
        students={students}
        viewer={viewer}
        emptyTitle="Нет занятий на этой неделе"
        emptyDescription="В выбранной неделе занятий нет."
      />
    </div>
  );
}
