import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { BackLink } from '@/components/ui/BackLink';
import { useCurrentUser } from '@/stores/authStore';
import { api } from '@/services/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { format } from 'date-fns';
import { cn } from '@/utils';

export default function NotificationsPage() {
  const user = useCurrentUser()!;
  const queryClient = useQueryClient();

  const { data: notifications, isLoading, error, refetch } = useQuery({
    queryKey: ['notifications', user.id],
    queryFn: () => api.notifications.getNotifications(user.id),
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.notifications.markAllAsRead(user.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  if (error) return <div className="page-container"><ErrorState onRetry={() => refetch()} /></div>;

  const unread = notifications?.filter((n) => !n.read).length ?? 0;

  return (
    <div className="page-container max-w-lg">
      <div className="mb-6 flex items-center justify-between">
        <BackLink label="Профиль" fallbackTo="/profile" className="mb-0 flex items-center gap-1 text-sm focus-ring rounded" />
        {unread > 0 && (
          <Button variant="ghost" size="sm" onClick={() => markAllMutation.mutate()} loading={markAllMutation.isPending}>
            Прочитать все
          </Button>
        )}
      </div>
      <h1 className="text-h1 mb-6">Уведомления</h1>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : notifications && notifications.length > 0 ? (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Link key={n.id} to={n.link ?? '#'}>
              <Card className={cn(!n.read && 'border-brand/30 bg-brand-muted/30')}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{n.title}</p>
                    <p className="mt-1 text-body-sm text-text-secondary">{n.body}</p>
                  </div>
                  <span className="text-caption tabular-nums shrink-0">
                    {format(new Date(n.createdAt), 'dd.MM HH:mm')}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState icon={Bell} title="Нет уведомлений" description="Здесь появятся важные события" />
      )}
    </div>
  );
}
