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
import { useMarkPassiveNotificationsOnLeave } from '@/hooks/useMarkPassiveNotificationsOnLeave';
import {
  isPassiveUnreadNotification,
  markPassiveNotificationsReadInList,
} from '@/services/notifications/helpers';
import type { AppNotification } from '@/types';

export default function NotificationsPage() {
  const user = useCurrentUser()!;
  const queryClient = useQueryClient();

  useMarkPassiveNotificationsOnLeave(user.id);

  const { data: notifications, isLoading, error, refetch } = useQuery({
    queryKey: ['notifications', user.id],
    queryFn: () => api.notifications.getNotifications(user.id),
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.notifications.markAllAsRead(user.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications', user.id] });
      const previous = queryClient.getQueryData<AppNotification[]>(['notifications', user.id]);
      queryClient.setQueryData<AppNotification[]>(['notifications', user.id], (old) =>
        old ? markPassiveNotificationsReadInList(old) : old,
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(['notifications', user.id], ctx.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
    },
  });

  if (error) {
    return (
      <div className="page-container">
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  const passiveUnread = notifications?.filter(isPassiveUnreadNotification).length ?? 0;

  return (
    <div className="page-container max-w-lg">
      <div className="mb-6 flex items-center justify-between">
        <BackLink label="Профиль" fallbackTo="/profile" className="mb-0" />
        {passiveUnread > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllMutation.mutate()}
            loading={markAllMutation.isPending}
          >
            Прочитать все
          </Button>
        )}
      </div>
      <h1 className="text-h1 mb-6">Уведомления</h1>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : notifications && notifications.length > 0 ? (
        <div className="space-y-2" role="list" aria-label="Список уведомлений">
          {notifications.map((n, index) => {
            const unread = !n.read;
            const urgent = Boolean(n.urgent && unread);
            return (
              <Link key={n.id} to={n.link ?? '#'} role="listitem">
                <Card
                  className={cn(
                    'transition-[border-color,background-color,box-shadow] duration-300 ease-out',
                    unread &&
                      'border-brand/30 bg-brand-muted/30 shadow-[inset_3px_0_0_0_var(--color-brand)]',
                    urgent &&
                      'border-danger/40 bg-danger-muted/20 shadow-[inset_3px_0_0_0_var(--color-danger)]',
                    unread && 'motion-safe:animate-fade-in',
                  )}
                  style={
                    unread ? { animationDelay: `${Math.min(index, 8) * 40}ms` } : undefined
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={cn('font-medium', unread && 'text-text-primary')}>{n.title}</p>
                        {n.urgent && (
                          <span className="rounded-md bg-danger-muted px-1.5 py-0.5 text-xs font-medium text-danger">
                            Срочно
                          </span>
                        )}
                        {unread && (
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand motion-safe:animate-pulse"
                            aria-label="Непрочитано"
                          />
                        )}
                      </div>
                      <p className="mt-1 text-body-sm text-text-secondary">{n.body}</p>
                    </div>
                    <span className="shrink-0 text-caption tabular-nums">
                      {format(new Date(n.createdAt), 'dd.MM HH:mm')}
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={Bell} title="Нет уведомлений" description="Здесь появятся важные события" />
      )}
    </div>
  );
}
