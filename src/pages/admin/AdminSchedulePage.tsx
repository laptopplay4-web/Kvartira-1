import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { useCurrentUser } from '@/stores/authStore';
import { api } from '@/services/api';
import type { LessonStatus } from '@/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LessonStatusBadge } from '@/components/ui/LessonStatusBadge';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { AdminPageHeader } from '@/components/ui/AdminPageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { LessonCalendar } from '@/components/calendar/LessonCalendar';
import { formatLessonDateTime } from '@/utils/dates';
import { formatUserName } from '@/utils';
import { parseISO } from 'date-fns';

export default function AdminSchedulePage() {
  const user = useCurrentUser()!;
  const [teacherFilter, setTeacherFilter] = useState('');
  const [directionFilter, setDirectionFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<LessonStatus | ''>('');

  const calendarFilters = {
    teacherId: teacherFilter || undefined,
    directionId: directionFilter || undefined,
    status: statusFilter || undefined,
  };

  const { data: lessons, isLoading, error, refetch } = useQuery({
    queryKey: ['lessons', 'admin-list', teacherFilter, directionFilter, dateFilter, statusFilter],
    queryFn: () =>
      api.lessons.getLessons({
        requesterId: user.id,
        teacherId: teacherFilter || undefined,
        directionId: directionFilter || undefined,
        status: statusFilter || undefined,
        from: dateFilter || undefined,
        to: dateFilter || undefined,
      }),
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.users.getAllUsers(),
  });

  const { data: directions } = useQuery({
    queryKey: ['directions'],
    queryFn: () => api.lessons.getDirections(),
  });

  const teachers = users?.filter((u) => u.role === 'teacher') ?? [];

  const filtered = lessons?.sort((a, b) =>
    `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`),
  );

  if (error) return <div className="page-container"><ErrorState onRetry={() => refetch()} /></div>;

  return (
    <div className="page-container">
      <AdminPageHeader title="Общее расписание" />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <select
          value={teacherFilter}
          onChange={(e) => setTeacherFilter(e.target.value)}
          className="min-h-11 rounded-lg border border-border-subtle bg-surface-elevated px-3 text-sm focus-ring"
          aria-label="Фильтр по преподавателю"
        >
          <option value="">Все преподаватели</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>{formatUserName(t)}</option>
          ))}
        </select>
        <select
          value={directionFilter}
          onChange={(e) => setDirectionFilter(e.target.value)}
          className="min-h-11 rounded-lg border border-border-subtle bg-surface-elevated px-3 text-sm focus-ring"
          aria-label="Фильтр по направлению"
        >
          <option value="">Все направления</option>
          {directions?.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="min-h-11 rounded-lg border border-border-subtle bg-surface-elevated px-3 text-sm focus-ring"
          aria-label="Фильтр по дате"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as LessonStatus | '')}
          className="min-h-11 rounded-lg border border-border-subtle bg-surface-elevated px-3 text-sm focus-ring"
          aria-label="Фильтр по статусу"
        >
          <option value="">Все статусы</option>
          <option value="scheduled">Запланировано</option>
          <option value="confirmed">Подтверждено</option>
          <option value="rescheduled">Перенесено</option>
          <option value="completed">Завершено</option>
          <option value="cancelled">Отменено</option>
          <option value="no_show">Не состоялось</option>
        </select>
      </div>

      <LessonCalendar
        viewer={user}
        filters={calendarFilters}
        defaultView={dateFilter ? 'day' : 'week'}
        initialAnchor={dateFilter ? parseISO(dateFilter) : undefined}
        showBookAction={false}
        className="mb-8"
        key={dateFilter || 'default'}
      />

      <h2 className="mb-3 text-label">Список занятий</h2>
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : filtered && filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((lesson) => {
            const teacher = users?.find((u) => u.id === lesson.teacherId);
            const student = users?.find((u) => u.id === lesson.studentId);
            const direction = directions?.find((d) => d.id === lesson.directionId);
            return (
              <Link key={lesson.id} to={`/lessons/${lesson.id}`}>
                <Card interactive>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="brand">{direction?.name}</Badge>
                    <LessonStatusBadge status={lesson.status} />
                  </div>
                  <p className="text-h3 tabular-nums">{formatLessonDateTime(lesson.date, lesson.startTime)}</p>
                  <p className="mt-1 text-body-sm text-text-secondary">
                    {teacher && formatUserName(teacher)} · {student && formatUserName(student)}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={CalendarDays}
          title="Нет занятий"
          description="На выбранный период занятий нет. Попробуйте изменить фильтры."
          className="py-8"
        />
      )}
    </div>
  );
}
