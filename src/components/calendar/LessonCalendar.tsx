import { useState, useMemo } from 'react';
import { format, parseISO, isToday } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import type { User } from '@/types';
import { api } from '@/services/api';
import { useCalendarLessons, type CalendarFilters } from '@/hooks/useCalendarLessons';
import {
  getCalendarDateRange,
  shiftCalendarAnchor,
  type CalendarViewMode,
} from '@/utils/calendarRanges';
import { CalendarNav } from './CalendarNav';
import { CalendarViewSwitcher } from './CalendarViewSwitcher';
import { DayView } from './DayView';
import { WeekView } from './WeekView';
import { MonthView } from './MonthView';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/utils';

interface LessonCalendarProps {
  viewer: User;
  filters?: CalendarFilters;
  defaultView?: CalendarViewMode;
  initialAnchor?: Date;
  showBookAction?: boolean;
  className?: string;
}

function CalendarSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

function getNavTitle(view: CalendarViewMode, anchor: Date): string {
  if (view === 'day') {
    if (isToday(anchor)) return 'Сегодня';
    return format(anchor, 'd MMMM yyyy', { locale: ru });
  }
  if (view === 'week') {
    const { from, to } = getCalendarDateRange('week', anchor);
    return `${format(parseISO(from), 'd MMM', { locale: ru })} – ${format(parseISO(to), 'd MMM yyyy', { locale: ru })}`;
  }
  return format(anchor, 'LLLL yyyy', { locale: ru });
}

export function LessonCalendar({
  viewer,
  filters,
  defaultView = 'day',
  initialAnchor,
  showBookAction = true,
  className,
}: LessonCalendarProps) {
  const [view, setView] = useState<CalendarViewMode>(defaultView);
  const [anchor, setAnchor] = useState(() => initialAnchor ?? new Date());

  const { from, to } = getCalendarDateRange(view, anchor);
  const selectedDate = format(anchor, 'yyyy-MM-dd');

  const { data: lessons, isLoading, error, refetch } = useCalendarLessons({
    userId: viewer.id,
    role: viewer.role,
    view,
    anchorDate: anchor,
    filters,
  });

  const { data: directionsList } = useQuery({
    queryKey: ['directions'],
    queryFn: () => api.lessons.getDirections(),
  });

  const { data: teachersList } = useQuery({
    queryKey: ['teachers'],
    queryFn: () => api.lessons.getTeachers(),
  });

  const { data: usersList } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.users.getAllUsers(),
    enabled: viewer.role !== 'student',
  });

  const directions = useMemo(
    () => new Map(directionsList?.map((d) => [d.id, d.name]) ?? []),
    [directionsList],
  );
  const teachers = useMemo(
    () => new Map(teachersList?.map((t) => [t.id, t]) ?? []),
    [teachersList],
  );
  const students = useMemo(() => {
    const map = new Map<string, User>();
    for (const u of usersList ?? []) {
      if (u.role === 'student') map.set(u.id, u);
    }
    return map;
  }, [usersList]);

  const handleDayClick = (dateStr: string) => {
    setAnchor(parseISO(dateStr));
    setView('day');
  };

  if (error) {
    return (
      <ErrorState
        title="Не удалось загрузить расписание"
        message="Попробуйте ещё раз."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <section className={cn('w-full min-w-0 max-w-full overflow-hidden', className)} aria-label="Календарь занятий">
      <div className="mb-4 space-y-3">
        <CalendarViewSwitcher view={view} onChange={setView} />
        <CalendarNav
          title={getNavTitle(view, anchor)}
          onPrev={() => setAnchor((a) => shiftCalendarAnchor(view, a, -1))}
          onNext={() => setAnchor((a) => shiftCalendarAnchor(view, a, 1))}
          onToday={() => setAnchor(new Date())}
        />
      </div>

      {isLoading ? (
        <CalendarSkeleton />
      ) : (
        <>
          {view === 'day' && lessons && (
            <DayView
              date={selectedDate}
              lessons={lessons}
              directions={directions}
              teachers={teachers}
              students={students}
              viewer={viewer}
              showBookAction={showBookAction}
            />
          )}
          {view === 'week' && lessons && (
            <WeekView
              from={from}
              to={to}
              lessons={lessons}
              directions={directions}
              teachers={teachers}
              students={students}
              viewer={viewer}
              onDayClick={handleDayClick}
            />
          )}
          {view === 'month' && lessons && (
            <MonthView anchor={anchor} lessons={lessons} onDayClick={handleDayClick} />
          )}
        </>
      )}
    </section>
  );
}
