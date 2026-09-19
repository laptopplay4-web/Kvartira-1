import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  parseISO,
} from 'date-fns';
import { normalizeLessonDate } from '@/utils/dates';

export type CalendarViewMode = 'day' | 'week' | 'month';

export interface CalendarDateRange {
  from: string;
  to: string;
}

/** Local midnight from `YYYY-MM-DD` (no UTC shift). */
export function parseCalendarDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return parseISO(dateStr);
  return new Date(y, m - 1, d);
}

export function getCalendarDateRange(view: CalendarViewMode, anchor: Date): CalendarDateRange {
  switch (view) {
    case 'day':
      return {
        from: format(startOfDay(anchor), 'yyyy-MM-dd'),
        to: format(endOfDay(anchor), 'yyyy-MM-dd'),
      };
    case 'week':
      return {
        from: format(startOfWeek(anchor, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        to: format(endOfWeek(anchor, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      };
    case 'month':
      return {
        from: format(startOfMonth(anchor), 'yyyy-MM-dd'),
        to: format(endOfMonth(anchor), 'yyyy-MM-dd'),
      };
  }
}

/**
 * API fetch window for calendar views.
 * Day/week expand to enclosing month(s) — narrow YCLIENTS `start_date`/`end_date`
 * ranges often miss records that a full-month query returns.
 */
export function getCalendarFetchRange(view: CalendarViewMode, anchor: Date): CalendarDateRange {
  const viewRange = getCalendarDateRange(view, anchor);
  if (view === 'month') return viewRange;

  const fromDate = parseCalendarDate(viewRange.from);
  const toDate = parseCalendarDate(viewRange.to);
  return {
    from: format(startOfMonth(fromDate), 'yyyy-MM-dd'),
    to: format(endOfMonth(toDate), 'yyyy-MM-dd'),
  };
}

export function filterLessonsByDateRange<T extends { date: string }>(
  lessons: T[],
  from: string,
  to: string,
): T[] {
  return lessons.filter((lesson) => {
    const date = normalizeLessonDate(lesson.date) || lesson.date;
    if (!date) return false;
    return date >= from && date <= to;
  });
}

export function shiftCalendarAnchor(view: CalendarViewMode, anchor: Date, direction: -1 | 1): Date {
  const d = new Date(anchor);
  if (view === 'day') {
    d.setDate(d.getDate() + direction);
  } else if (view === 'week') {
    d.setDate(d.getDate() + direction * 7);
  } else {
    d.setMonth(d.getMonth() + direction);
  }
  return d;
}
