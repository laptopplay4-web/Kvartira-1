import type { LessonStatus } from '@/types';
import { Calendar, CheckCircle, Clock, XCircle, ArrowRightLeft, Ban } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const LESSON_STATUS_CONFIG: Record<
  LessonStatus,
  { label: string; color: string; bg: string; icon: LucideIcon }
> = {
  scheduled: {
    label: 'Запланировано',
    color: 'text-info',
    bg: 'bg-info-muted',
    icon: Calendar,
  },
  confirmed: {
    label: 'Подтверждено',
    color: 'text-success',
    bg: 'bg-success-muted',
    icon: CheckCircle,
  },
  completed: {
    label: 'Завершено',
    color: 'text-text-muted',
    bg: 'bg-surface-elevated',
    icon: CheckCircle,
  },
  cancelled: {
    label: 'Отменено',
    color: 'text-danger',
    bg: 'bg-danger-muted',
    icon: XCircle,
  },
  rescheduled: {
    label: 'Перенесено',
    color: 'text-warning',
    bg: 'bg-warning-muted',
    icon: ArrowRightLeft,
  },
  pending: {
    label: 'Ожидает подтверждения',
    color: 'text-warning',
    bg: 'bg-warning-muted',
    icon: Clock,
  },
  no_show: {
    label: 'Не состоялось',
    color: 'text-danger',
    bg: 'bg-danger-muted',
    icon: Ban,
  },
};
