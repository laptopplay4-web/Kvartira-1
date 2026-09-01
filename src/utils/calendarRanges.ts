import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from 'date-fns';

export type CalendarViewMode = 'day' | 'week' | 'month';

export interface CalendarDateRange {
  from: string;
  to: string;
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
