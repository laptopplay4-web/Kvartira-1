import { AlertCircle } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/utils';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Что-то пошло не так',
  message = 'Не удалось загрузить данные',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center justify-center py-12 text-center select-text', className)}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-muted">
        <AlertCircle className="h-7 w-7 text-danger" aria-hidden />
      </div>
      <h3 className="text-h3">{title}</h3>
      <p className="mt-2 text-body-sm text-text-secondary">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-6" onClick={onRetry}>
          Повторить
        </Button>
      )}
    </div>
  );
}
