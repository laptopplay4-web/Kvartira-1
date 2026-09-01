import type { LessonStatus } from '@/types';
import { Badge } from './Badge';
import { LESSON_STATUS_CONFIG } from '@/utils/lessonStatus';
import { cn } from '@/utils';

interface LessonStatusBadgeProps {
  status: LessonStatus;
  className?: string;
}

export function LessonStatusBadge({ status, className }: LessonStatusBadgeProps) {
  const config = LESSON_STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <Badge className={cn(config.bg, config.color, className)}>
      <Icon className="h-3 w-3" aria-hidden />
      {config.label}
    </Badge>
  );
}
