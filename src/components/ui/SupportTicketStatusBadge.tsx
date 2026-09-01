import { Badge } from '@/components/ui/Badge';
import type { SupportTicket } from '@/types';
import { SUPPORT_STATUS_LABELS } from '@/services/support/helpers';

const STATUS_VARIANT: Record<SupportTicket['status'], 'warning' | 'success' | 'default'> = {
  open: 'warning',
  answered: 'success',
  closed: 'default',
};

export function SupportTicketStatusBadge({ status }: { status: SupportTicket['status'] }) {
  return <Badge variant={STATUS_VARIANT[status]}>{SUPPORT_STATUS_LABELS[status]}</Badge>;
}
