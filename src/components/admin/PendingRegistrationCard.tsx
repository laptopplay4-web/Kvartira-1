import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { getRoleLabel, getRoleBadgeVariant } from '@/permissions';
import { canApproveUser, canRejectUser } from '@/services/users/access';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { UserPreviewTrigger } from '@/components/users/UserPreviewTrigger';
import { formatUserName } from '@/utils';
import type { User } from '@/types';

interface PendingRegistrationCardProps {
  user: User;
  currentUser: User;
  compact?: boolean;
}

export function PendingRegistrationCard({
  user,
  currentUser,
  compact = false,
}: PendingRegistrationCardProps) {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const [rejectOpen, setRejectOpen] = useState(false);

  const canApprove = canApproveUser(currentUser, user);
  const canReject = canRejectUser(currentUser, user);

  const approveMutation = useMutation({
    mutationFn: () => api.users.approveUser(currentUser.id, user.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => api.users.rejectUser(currentUser.id, user.id),
    onSuccess: () => {
      setRejectOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const actionError =
    approveMutation.error instanceof ApiError
      ? approveMutation.error.message
      : rejectMutation.error instanceof ApiError
        ? rejectMutation.error.message
        : approveMutation.error || rejectMutation.error
          ? 'Не удалось обработать заявку'
          : '';

  const busy = approveMutation.isPending || rejectMutation.isPending;

  return (
    <>
      <Card className={compact ? 'flex items-center gap-3' : 'space-y-3'}>
        <div className={`flex min-w-0 items-center gap-3 ${compact ? 'flex-1' : ''}`}>
          <UserPreviewTrigger user={user} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-0">
            <Avatar src={user.avatarUrl} firstName={user.firstName} lastName={user.lastName} />
            <div className="min-w-0 flex-1 text-left">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate font-medium">{formatUserName(user)}</p>
                <Badge variant={getRoleBadgeVariant(user.role)} className="shrink-0">
                  {getRoleLabel(user.role)}
                </Badge>
              </div>
              <p className="text-caption">{user.phone}</p>
            </div>
          </UserPreviewTrigger>
        </div>

        {(canApprove || canReject) && (
          <div className={`flex gap-2 ${compact ? 'shrink-0' : ''}`}>
            {canApprove && (
              <Button
                type="button"
                size="sm"
                disabled={!isOnline || busy}
                loading={approveMutation.isPending}
                onClick={() => approveMutation.mutate()}
                aria-label={`Одобрить: ${formatUserName(user)}`}
              >
                {!approveMutation.isPending && <Check className="h-4 w-4" aria-hidden />}
                Одобрить
              </Button>
            )}
            {canReject && (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={!isOnline || busy}
                onClick={() => setRejectOpen(true)}
                aria-label={`Отклонить: ${formatUserName(user)}`}
              >
                <X className="h-4 w-4" aria-hidden />
                Отклонить
              </Button>
            )}
          </div>
        )}

        {!isOnline && (
          <p className="text-caption text-warning" role="status">
            {OFFLINE_NETWORK_MESSAGE}
          </p>
        )}
        {actionError && (
          <p className="text-caption text-danger" role="alert">
            {actionError}
          </p>
        )}
      </Card>

      <ConfirmDialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onConfirm={() => rejectMutation.mutate()}
        title="Отклонить заявку?"
        description="Аккаунт будет удалён. Человек сможет снова зарегистрироваться по этому номеру."
        confirmLabel="Отклонить"
        tone="destructive"
        loading={rejectMutation.isPending}
        disabled={!isOnline}
      />
    </>
  );
}
