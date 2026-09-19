import { Link } from 'react-router-dom';
import type { Lesson, User as UserType } from '@/types';
import { Card } from './Card';
import { Badge } from './Badge';
import { LessonStatusBadge } from './LessonStatusBadge';
import { formatFullDate, formatLessonDateTime, formatTimeRange } from '@/utils/dates';
import { cn, formatUserName } from '@/utils';
import { ChevronRight, MapPin } from 'lucide-react';

interface LessonCardProps {
  lesson: Lesson;
  directionName: string;
  teacher?: UserType;
  student?: UserType;
  showTeacher?: boolean;
  /** Overrides computed person line (e.g. admin «teacher · student»). */
  personLabel?: string;
  className?: string;
}

/** Visit-style card: time-first layout (YCLIENTS cabinet). */
export function LessonCard({
  lesson,
  directionName,
  teacher,
  student,
  showTeacher = true,
  personLabel,
  className,
}: LessonCardProps) {
  const personName =
    personLabel ??
    (showTeacher && teacher
      ? formatUserName(teacher)
      : student
        ? formatUserName(student)
        : directionName);

  return (
    <Link to={`/lessons/${lesson.id}`} className={cn('block', className)}>
      <Card interactive className="group overflow-hidden p-0">
        <div className="flex">
          <div className="flex w-[4.75rem] shrink-0 flex-col items-center justify-center border-r border-border-subtle bg-brand-muted/35 px-2 py-3 sm:w-24">
            <p className="text-xl font-semibold tabular-nums leading-none sm:text-2xl">
              {lesson.startTime}
            </p>
            <p className="mt-1 text-caption tabular-nums text-text-muted">
              {lesson.durationMinutes} мин
            </p>
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 sm:px-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="brand">{directionName}</Badge>
                <LessonStatusBadge status={lesson.status} />
              </div>
              <h3 className="mt-1.5 truncate text-h3">{personName}</h3>
              <p className="mt-0.5 text-body-sm text-text-secondary tabular-nums">
                {formatFullDate(lesson.date)} ·{' '}
                {formatTimeRange(lesson.startTime, lesson.durationMinutes)}
              </p>
              {lesson.location ? (
                <p className="mt-1 flex items-center gap-1 text-caption text-text-muted">
                  <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                  {lesson.location}
                </p>
              ) : null}
            </div>
            <ChevronRight
              className="hidden h-5 w-5 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 sm:block"
              aria-hidden
            />
          </div>
        </div>
        <span className="sr-only">{formatLessonDateTime(lesson.date, lesson.startTime)}</span>
      </Card>
    </Link>
  );
}
