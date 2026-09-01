import { Link } from 'react-router-dom';
import type { Lesson, User } from '@/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LessonStatusBadge } from '@/components/ui/LessonStatusBadge';
import { formatTimeRange } from '@/utils/dates';
import { getLessonCounterpartyName, isLessonPast } from '@/services/calendar/helpers';
import { cn } from '@/utils';

interface CalendarLessonItemProps {
  lesson: Lesson;
  directionName: string;
  viewerRole: User['role'];
  teacher?: User;
  student?: User;
  compact?: boolean;
}

export function CalendarLessonItem({
  lesson,
  directionName,
  viewerRole,
  teacher,
  student,
  compact = false,
}: CalendarLessonItemProps) {
  const past = isLessonPast(lesson);
  const counterparty = getLessonCounterpartyName(lesson, viewerRole, teacher, student);

  return (
    <Link to={`/lessons/${lesson.id}`} className="block">
      <Card
        interactive
        padding={compact ? 'sm' : 'md'}
        className={cn(past && 'opacity-75')}
      >
        <div className="flex gap-3">
          <div className="shrink-0 text-right">
            <p className="text-h3 tabular-nums">{lesson.startTime}</p>
            {!compact && (
              <p className="text-caption tabular-nums text-text-muted">
                {formatTimeRange(lesson.startTime, lesson.durationMinutes)}
              </p>
            )}
          </div>
          <div className="min-w-0 flex-1 border-l border-border-subtle pl-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="brand">{directionName}</Badge>
              <LessonStatusBadge status={lesson.status} />
            </div>
            <p className={cn('mt-1 truncate', compact ? 'text-body-sm font-medium' : 'text-h3')}>
              {counterparty}
            </p>
            <p className="mt-0.5 text-caption text-text-secondary">
              {lesson.durationMinutes} мин
            </p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
