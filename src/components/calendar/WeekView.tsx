import { format, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Lesson, User } from '@/types';
import { CalendarLessonItem } from './CalendarLessonItem';
import { groupLessonsByDate } from '@/services/calendar/helpers';
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
  const days = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) });
  const byDate = groupLessonsByDate(lessons);
  const today = new Date();

  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-border-subtle">
      {/* Mobile: scroll days horizontally inside the card. Desktop: full-width 7-column grid. */}
      <div className="scroll-x-contained md:overflow-x-visible">
        <div className="flex w-max min-w-full gap-px bg-border-subtle md:grid md:w-full md:grid-cols-7">
          {days.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayLessons = byDate.get(dateStr) ?? [];
            const isToday = isSameDay(day, today);

            return (
              <div
                key={dateStr}
                className={cn(
                  'w-[9.25rem] shrink-0 bg-surface p-2 md:w-auto md:shrink md:min-w-0',
                  isToday && 'bg-brand-muted/30',
                )}
              >
                <button
                  type="button"
                  onClick={() => onDayClick?.(dateStr)}
                  className="mb-2 w-full rounded-lg p-1 text-left focus-ring"
                  aria-label={`${format(day, 'EEEE d MMMM', { locale: ru })}${dayLessons.length ? `, ${dayLessons.length} занятий` : ''}`}
                >
                  <p className="text-caption capitalize text-text-muted">
                    {format(day, 'EEE', { locale: ru })}
                  </p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-semibold tabular-nums">{format(day, 'd')}</span>
                    {isToday && (
                      <span className="rounded bg-brand/20 px-1.5 py-0.5 text-[10px] font-medium text-brand">
                        сегодня
                      </span>
                    )}
                  </div>
                  {dayLessons.length > 0 && (
                    <p className="mt-0.5 text-[10px] text-brand" aria-hidden>
                      ● {dayLessons.length}
                    </p>
                  )}
                </button>

                <div className="space-y-2">
                  {dayLessons.map((lesson) => (
                    <CalendarLessonItem
                      key={lesson.id}
                      lesson={lesson}
                      directionName={directions.get(lesson.directionId) ?? ''}
                      viewerRole={viewer.role}
                      teacher={teachers.get(lesson.teacherId)}
                      student={students.get(lesson.studentId)}
                      compact
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
