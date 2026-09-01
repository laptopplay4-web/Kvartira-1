import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BackLink } from '@/components/ui/BackLink';
import { format } from 'date-fns';
import { useCurrentUser } from '@/stores/authStore';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { canReplyToTicket } from '@/services/support/access';
import { SUPPORT_CATEGORY_LABELS } from '@/services/support/helpers';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { SupportTicketStatusBadge } from '@/components/ui/SupportTicketStatusBadge';
import { SupportAttachmentList } from '@/components/support/SupportAttachmentList';

export default function HelpTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useCurrentUser()!;
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const [replyText, setReplyText] = useState('');
  const [closeAfterReply, setCloseAfterReply] = useState(false);
  const [replyError, setReplyError] = useState('');

  const { data: ticket, isLoading, error, refetch } = useQuery({
    queryKey: ['support', 'ticket', id, user.id],
    queryFn: () => api.support.getTicket(id!, user.id),
    enabled: !!id,
  });

  const replyMutation = useMutation({
    mutationFn: () => api.support.replyToTicket(id!, { text: replyText, close: closeAfterReply }, user.id),
    onSuccess: () => {
      setReplyText('');
      setReplyError('');
      queryClient.invalidateQueries({ queryKey: ['support'] });
    },
    onError: (err) => {
      setReplyError(err instanceof ApiError ? err.message : 'Не удалось отправить ответ');
    },
  });

  if (!id) return <Navigate to="/profile/help" replace />;

  if (error) {
    return (
      <div className="page-container max-w-lg">
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  if (isLoading || !ticket) {
    return (
      <div className="page-container max-w-lg">
        <Skeleton className="mb-4 h-8 w-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const canReply = canReplyToTicket(user, ticket);

  function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!isOnline || !canReply) return;
    setReplyError('');
    replyMutation.mutate();
  }

  return (
    <div className="page-container max-w-lg">
      <div className="mb-6">
        <BackLink label="Помощь" fallbackTo="/profile/help" className="mb-0" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-h1 flex-1">{ticket.subject}</h1>
        <SupportTicketStatusBadge status={ticket.status} />
      </div>

      <Card className="mb-4">
        <dl className="space-y-2 text-body-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Категория</dt>
            <dd>{SUPPORT_CATEGORY_LABELS[ticket.category]}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Создано</dt>
            <dd>{format(new Date(ticket.createdAt), 'dd.MM.yyyy HH:mm')}</dd>
          </div>
        </dl>
        <p className="mt-4 text-body-sm whitespace-pre-wrap">{ticket.message}</p>
        <SupportAttachmentList attachments={ticket.attachments} />
      </Card>

      {ticket.adminReply && (
        <section className="mb-4" aria-labelledby="reply-heading">
          <h2 id="reply-heading" className="mb-2 text-label uppercase tracking-wide">
            Ответ администрации
          </h2>
          <Card className="border-success/20 bg-success-muted/30">
            <p className="text-body-sm whitespace-pre-wrap">{ticket.adminReply.text}</p>
            <p className="mt-2 text-caption text-text-muted">
              {format(new Date(ticket.adminReply.createdAt), 'dd.MM.yyyy HH:mm')}
            </p>
          </Card>
        </section>
      )}

      {canReply && (
        <section aria-labelledby="admin-reply-heading">
          <h2 id="admin-reply-heading" className="mb-2 text-label uppercase tracking-wide">
            Ответить
          </h2>
          {!isOnline && (
            <p className="mb-2 text-body-sm text-warning" role="alert">
              {OFFLINE_NETWORK_MESSAGE}
            </p>
          )}
          <Card>
            <form onSubmit={handleReply} className="space-y-3">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={4}
                minLength={10}
                required
                disabled={!isOnline}
                placeholder="Текст ответа пользователю…"
                aria-label="Текст ответа"
                className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-body-sm focus-ring"
              />
              <label className="flex items-center gap-2 text-body-sm">
                <input
                  type="checkbox"
                  checked={closeAfterReply}
                  onChange={(e) => setCloseAfterReply(e.target.checked)}
                  disabled={!isOnline}
                  className="h-4 w-4 rounded border-border-subtle"
                />
                Закрыть обращение после ответа
              </label>
              {replyError && (
                <p className="text-body-sm text-danger" role="alert">
                  {replyError}
                </p>
              )}
              <Button
                type="submit"
                className="w-full min-h-11"
                loading={replyMutation.isPending}
                disabled={!isOnline}
              >
                Отправить ответ
              </Button>
            </form>
          </Card>
        </section>
      )}
    </div>
  );
}
