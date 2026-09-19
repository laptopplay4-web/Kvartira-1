import type { Lesson, User } from '@/types';
import { EmptyState } from '@/components/ui/EmptyState';
import { CalendarDays } from 'lucide-react';
import { CalendarLessonItem } from './CalendarLessonItem';
import { groupLessonsByDate, sortLessonsByTime } from '@/services/calendar/helpers';
import { formatFullDate, normalizeLessonDate } from '@/utils/dates';

interface CalendarLessonListProps {
  lessons: Lesson[];
  directions: Map<string, string>;
  teachers: Map<string, User>;
  students: Map<string, User>;
  viewer: User;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

/**
 * Chronological list of lessons grouped by date (nearest → farthest).
 * Used under week / month calendar grids.
 */
export function CalendarLessonList({
  lessons,
  directions,
  teachers,
  students,
  viewer,
  emptyTitle = 'Нет занятий',
  emptyDescription = 'В выбранном периоде занятий нет.',
  className,
}: CalendarLessonListProps) {
  const sorted = sortLessonsByTime(lessons);
  const byDate = groupLessonsByDate(sorted);
  const dates = [...byDate.keys()].sort();

  if (dates.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title={emptyTitle}
        description={emptyDescription}
        className={className ?? 'py-8'}
      />
    );
  }

  return (
    <div className={className ?? 'space-y-5'}>
      {dates.map((date) => {
        const dayLessons = byDate.get(date) ?? [];
        const label = formatFullDate(normalizeLessonDate(date) || date);
        return (
          <section key={date} aria-label={label}>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h3 className="text-body-sm font-medium capitalize text-text-primary">{label}</h3>
              <p className="text-caption tabular-nums text-text-muted">
                {dayLessons.length}{' '}
                {dayLessons.length === 1 ? 'запись' : dayLessons.length < 5 ? 'записи' : 'записей'}
              </p>
            </div>
            <div className="relative space-y-2 border-l-2 border-brand/25 pl-3">
              {dayLessons.map((lesson) => (
                <CalendarLessonItem
                  key={lesson.id}
                  lesson={lesson}
                  directionName={directions.get(lesson.directionId) ?? ''}
                  viewerRole={viewer.role}
                  teacher={teachers.get(lesson.teacherId)}
                  student={students.get(lesson.studentId)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
