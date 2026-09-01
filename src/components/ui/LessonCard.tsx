import { Link } from 'react-router-dom';

import type { Lesson, User as UserType } from '@/types';

import { Card } from './Card';

import { Badge } from './Badge';

import { LessonStatusBadge } from './LessonStatusBadge';

import { formatLessonDateTime } from '@/utils/dates';

import { cn, formatUserName } from '@/utils';

import { ChevronRight, Clock } from 'lucide-react';



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

      <Card interactive className="group">

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

          <div className="min-w-0 flex-1">

            <div className="flex flex-wrap items-center gap-2">

              <Badge variant="brand">{directionName}</Badge>

              <LessonStatusBadge status={lesson.status} />

            </div>

            <h3 className="mt-2 text-h3 truncate">{personName}</h3>

            <p className="mt-1 flex items-center gap-1.5 text-body-sm text-text-secondary tabular-nums">

              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />

              {formatLessonDateTime(lesson.date, lesson.startTime)} · {lesson.durationMinutes} мин

            </p>

            {lesson.location && (

              <p className="mt-1 text-caption">{lesson.location}</p>

            )}

          </div>

          <ChevronRight

            className="hidden h-5 w-5 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 sm:block"

            aria-hidden

          />

        </div>

      </Card>

    </Link>

  );

}


