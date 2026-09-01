import { Link } from 'react-router-dom';
import type { Lesson, User } from '@/types';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { CalendarDays } from 'lucide-react';
import { CalendarLessonItem } from './CalendarLessonItem';
import { sortLessonsByTime } from '@/services/calendar/helpers';
import { formatFullDate } from '@/utils/dates';
import { can } from '@/permissions';

interface DayViewProps {
  date: string;
  lessons: Lesson[];
  directions: Map<string, string>;
  teachers: Map<string, User>;
  students: Map<string, User>;
  viewer: User;
  showBookAction?: boolean;
}

export function DayView({
  date,
  lessons,
  directions,
  teachers,
  students,
  viewer,
  showBookAction,
}: DayViewProps) {
  const dayLessons = sortLessonsByTime(lessons.filter((l) => l.date === date));

  if (dayLessons.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Нет занятий"
        description="На выбранную дату занятий нет."
        action={
          showBookAction && can(viewer, 'lessons:book') ? (
            <Link to="/lessons/book">
              <Button>Записаться на занятие</Button>
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-body-sm text-text-secondary capitalize">{formatFullDate(date)}</p>
      <div className="space-y-2">
        {dayLessons.map((lesson) => (
          <CalendarLessonItem
            key={lesson.id}
            lesson={lesson}
            directionName={directions.get(lesson.directionId) ?? ''}
            viewerRole={viewer.role}
            teacher={teachers.get(lesson.teacherId)}
            student={students.get(lesson.studentId)}
          />
        ))}
      </div>
    </div>
  );
}
