import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { Lesson, LessonStatus, User } from '@/types';
import {
  filterLessonsByDateRange,
  getCalendarDateRange,
  getCalendarFetchRange,
  type CalendarViewMode,
} from '@/utils/calendarRanges';
import { buildLessonFiltersForRole } from '@/services/calendar/helpers';

export interface CalendarFilters {
  teacherId?: string;
  directionId?: string;
  status?: LessonStatus;
}

export interface UseCalendarLessonsParams {
  userId: string;
  role: User['role'];
  view: CalendarViewMode;
  anchorDate: Date;
  filters?: CalendarFilters;
  schoolWide?: boolean;
  enabled?: boolean;
}

export function calendarLessonsQueryKey(
  userId: string,
  role: User['role'],
  view: CalendarViewMode,
  anchorDate: Date,
  filters?: CalendarFilters,
  schoolWide = false,
) {
  // Shared cache for day/week/month within the same fetch months (view filtered via select).
  const { from, to } = getCalendarFetchRange(view, anchorDate);
  return [
    'lessons',
    'calendar',
    userId,
    role,
    from,
    to,
    filters?.teacherId ?? '',
    filters?.directionId ?? '',
    filters?.status ?? '',
    schoolWide ? 'school' : 'own',
  ] as const;
}

export function useCalendarLessons({
  userId,
  role,
  view,
  anchorDate,
  filters,
  schoolWide = false,
  enabled = true,
}: UseCalendarLessonsParams) {
  const fetchRange = getCalendarFetchRange(view, anchorDate);
  const viewRange = getCalendarDateRange(view, anchorDate);

  return useQuery({
    queryKey: calendarLessonsQueryKey(userId, role, view, anchorDate, filters, schoolWide),
    queryFn: (): Promise<Lesson[]> => {
      const roleFilters = buildLessonFiltersForRole(userId, role, {
        teacherId: filters?.teacherId,
        schoolWide,
      });

      return api.lessons.getLessons({
        ...roleFilters,
        from: fetchRange.from,
        to: fetchRange.to,
        directionId: filters?.directionId,
        status: filters?.status,
      });
    },
    select: (lessons) => filterLessonsByDateRange(lessons, viewRange.from, viewRange.to),
    enabled,
  });
}
