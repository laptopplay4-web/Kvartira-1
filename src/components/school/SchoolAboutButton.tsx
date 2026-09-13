import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { useCurrentUser } from '@/stores/authStore';
import { Modal } from '@/components/ui/Modal';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { SchoolAboutContent } from '@/components/school/SchoolAboutContent';
import { cn } from '@/utils';

interface SchoolAboutButtonProps {
  className?: string;
}

export function SchoolAboutButton({ className }: SchoolAboutButtonProps) {
  const user = useCurrentUser();
  const [open, setOpen] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['school-settings'],
    queryFn: () => api.schoolSettings.getSchoolSettings(user!.id),
    enabled: open && !!user,
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-brand focus-ring',
          className,
        )}
        aria-haspopup="dialog"
      >
        <Building2 className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
        О школе
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="О школе" size="lg">
        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-6 w-2/3 rounded-lg" />
            <Skeleton className="h-4 w-1/2 rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        )}

        {error && (
          <ErrorState
            message={error instanceof ApiError ? error.message : undefined}
            onRetry={() => refetch()}
          />
        )}

        {data && <SchoolAboutContent school={data} />}
      </Modal>
    </>
  );
}
