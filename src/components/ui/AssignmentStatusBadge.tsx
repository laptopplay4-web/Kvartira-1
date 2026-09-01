import type { Assignment } from '@/types';
import { getAssignmentDisplayStatus } from '@/services/assignments/helpers';
import { Badge } from './Badge';
import { ASSIGNMENT_STATUS_CONFIG } from '@/utils/assignmentStatus';
import { cn } from '@/utils';

interface AssignmentStatusBadgeProps {
  assignment: Assignment;
  className?: string;
}

export function AssignmentStatusBadge({ assignment, className }: AssignmentStatusBadgeProps) {
  const status = getAssignmentDisplayStatus(assignment);
  const config = ASSIGNMENT_STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <Badge className={cn(config.bg, config.color, className)}>
      <Icon className="h-3 w-3" aria-hidden />
      {config.label}
    </Badge>
  );
}
