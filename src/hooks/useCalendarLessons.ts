import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { Lesson, LessonStatus, User } from '@/types';
import { getCalendarDateRange, type CalendarViewMode } from '@/utils/calendarRanges';
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
  const { from, to } = getCalendarDateRange(view, anchorDate);
  return [
    'lessons',
    'calendar',
    userId,
    role,
    view,
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
  const { from, to } = getCalendarDateRange(view, anchorDate);

  return useQuery({
    queryKey: calendarLessonsQueryKey(userId, role, view, anchorDate, filters, schoolWide),
    queryFn: (): Promise<Lesson[]> => {
      const roleFilters = buildLessonFiltersForRole(userId, role, {
        teacherId: filters?.teacherId,
        schoolWide,
      });

      return api.lessons.getLessons({
        ...roleFilters,
        from,
        to,
        directionId: filters?.directionId,
        status: filters?.status,
      });
    },
    enabled,
  });
}
