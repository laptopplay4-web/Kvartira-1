import { Calendar, Clock, MapPin } from 'lucide-react';
import type { LessonStatus, User } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { LessonStatusBadge } from '@/components/ui/LessonStatusBadge';
import { UserPreviewTrigger } from '@/components/users/UserPreviewTrigger';
import { formatFullDate, formatTimeRange } from '@/utils/dates';
import { formatUserName } from '@/utils';

interface LessonVisitHeroProps {
  directionName: string;
  status: LessonStatus;
  date: string;
  startTime: string;
  durationMinutes: number;
  location?: string;
  teacher?: User;
  student?: User;
  showStudent?: boolean;
}

/** Salon-style visit summary: time-first, people, place. */
export function LessonVisitHero({
  directionName,
  status,
  date,
  startTime,
  durationMinutes,
  location,
  teacher,
  student,
  showStudent = false,
}: LessonVisitHeroProps) {
  return (
    <article className="overflow-hidden rounded-2xl border border-border-subtle bg-surface motion-safe:animate-fade-in">
      <div className="border-b border-border-subtle bg-brand-muted/40 px-4 py-5 sm:px-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant="brand">{directionName}</Badge>
          <LessonStatusBadge status={status} />
        </div>
        <p className="text-caption text-text-secondary">Время визита</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-text-primary sm:text-4xl">
          {startTime}
        </p>
        <p className="mt-1 text-body-sm text-text-secondary tabular-nums">
          {formatTimeRange(startTime, durationMinutes)} · {durationMinutes} мин
        </p>
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-5">
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-body-sm">
            <Calendar className="h-4 w-4 shrink-0 text-brand" aria-hidden />
            {formatFullDate(date)}
          </p>
          <p className="flex items-center gap-2 text-body-sm tabular-nums">
            <Clock className="h-4 w-4 shrink-0 text-brand" aria-hidden />
            {formatTimeRange(startTime, durationMinutes)}
          </p>
          {location ? (
            <p className="flex items-center gap-2 text-body-sm">
              <MapPin className="h-4 w-4 shrink-0 text-brand" aria-hidden />
              {location}
            </p>
          ) : null}
        </div>

        {teacher ? (
          <UserPreviewTrigger
            user={teacher}
            className="flex w-full items-center gap-3 rounded-xl border border-border-subtle bg-surface-elevated p-3 text-left"
          >
            <Avatar
              src={teacher.avatarUrl}
              firstName={teacher.firstName}
              lastName={teacher.lastName}
              size="lg"
            />
            <div className="min-w-0">
              <p className="text-caption">Преподаватель</p>
              <p className="text-h3 truncate">{formatUserName(teacher)}</p>
            </div>
          </UserPreviewTrigger>
        ) : null}

        {showStudent && student ? (
          <UserPreviewTrigger
            user={student}
            className="flex w-full items-center gap-3 rounded-xl border border-border-subtle bg-surface-elevated p-3 text-left"
          >
            <Avatar
              src={student.avatarUrl}
              firstName={student.firstName}
              lastName={student.lastName}
            />
            <div className="min-w-0">
              <p className="text-caption">Ученик</p>
              <p className="font-medium truncate">{formatUserName(student)}</p>
            </div>
          </UserPreviewTrigger>
        ) : null}
      </div>
    </article>
  );
}
