import { ArrowRightLeft, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface LessonVisitActionsProps {
  canReschedule: boolean;
  canCancel: boolean;
  isOnline: boolean;
  onReschedule: () => void;
  onCancel: () => void;
}

/** Primary visit actions — salon-style full-width buttons. */
export function LessonVisitActions({
  canReschedule,
  canCancel,
  isOnline,
  onReschedule,
  onCancel,
}: LessonVisitActionsProps) {
  if (!canReschedule && !canCancel) return null;

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {canReschedule ? (
        <Button
          variant="secondary"
          fullWidth
          className="min-h-12"
          disabled={!isOnline}
          onClick={() => {
            if (!isOnline) return;
            onReschedule();
          }}
        >
          <ArrowRightLeft className="h-4 w-4" aria-hidden />
          Перенести
        </Button>
      ) : null}
      {canCancel ? (
        <Button
          variant="destructive"
          fullWidth
          className="min-h-12"
          disabled={!isOnline}
          onClick={() => {
            if (!isOnline) return;
            onCancel();
          }}
        >
          <XCircle className="h-4 w-4" aria-hidden />
          Отменить запись
        </Button>
      ) : null}
    </div>
  );
}
