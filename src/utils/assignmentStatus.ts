import type { AssignmentDisplayStatus } from '@/types';
import { AlertCircle, CheckCircle, Clock, Send } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const ASSIGNMENT_STATUS_CONFIG: Record<
  AssignmentDisplayStatus,
  { label: string; color: string; bg: string; icon: LucideIcon }
> = {
  assigned: {
    label: 'К выполнению',
    color: 'text-info',
    bg: 'bg-info-muted',
    icon: Clock,
  },
  overdue: {
    label: 'Просрочено',
    color: 'text-danger',
    bg: 'bg-danger-muted',
    icon: AlertCircle,
  },
  submitted: {
    label: 'На проверке',
    color: 'text-warning',
    bg: 'bg-warning-muted',
    icon: Send,
  },
  reviewed: {
    label: 'Проверено',
    color: 'text-success',
    bg: 'bg-success-muted',
    icon: CheckCircle,
  },
};
