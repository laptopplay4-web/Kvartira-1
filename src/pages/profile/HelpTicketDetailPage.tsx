import { useState } from 'react';
import { Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BackLink } from '@/components/ui/BackLink';
import { format } from 'date-fns';
import { MessageSquareWarning } from 'lucide-react';
import { useCurrentUser } from '@/stores/authStore';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { canReplyToTicket } from '@/services/support/access';
import { adminHelpListPath, isAdminHelpTicketPath } from '@/services/support/adminInbox';
import { SUPPORT_CATEGORY_LABELS } from '@/services/support/helpers';
import {
  MESSAGE_REPORT_REASON_LABELS,
  buildReportedMessageChatLink,
  extractReportComment,
} from '@/services/support/reportMessage';
import { resolveReportDisplayLabels } from '@/services/support/reportContext';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { SupportTicketStatusBadge } from '@/components/ui/SupportTicketStatusBadge';
import { SupportAttachmentList } from '@/components/support/SupportAttachmentList';
import { can } from '@/permissions';

export default function HelpTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useCurrentUser()!;
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const [replyText, setReplyText] = useState('');
  const [closeAfterReply, setCloseAfterReply] = useState(false);
  const [replyError, setReplyError] = useState('');

  const fromAdminInbox = isAdminHelpTicketPath(location.pathname);
  const isAdminInbox = can(user, 'support:view-all-tickets');
  const listFallback = fromAdminInbox || isAdminInbox ? adminHelpListPath() : '/profile/help';
  const backLabel = 'Помощь';

  const { data: ticket, isLoading, error, refetch } = useQuery({
    queryKey: ['support', 'ticket', id, user.id],
    queryFn: () => api.support.getTicket(id!, user.id),
    enabled: !!id,
  });

  const reportCtx = ticket?.reportContext;
  const canViewReport = !!reportCtx && isAdminInbox;

  const replyMutation = useMutation({
    mutationFn: () => api.support.replyToTicket(id!, { text: replyText, close: closeAfterReply }, user.id),
    onSuccess: () => {
      setReplyText('');
      setReplyError('');
      queryClient.invalidateQueries({ queryKey: ['support'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err) => {
      setReplyError(err instanceof ApiError ? err.message : 'Не удалось отправить ответ');
    },
  });

  if (!id) return <Navigate to={listFallback} replace />;

  /** Admin must work tickets from `/admin/help`, not profile inbox. */
  if (ticket && isAdminInbox && !fromAdminInbox) {
    return <Navigate to={`/admin/help/${ticket.id}`} replace />;
  }

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
  const reportComment = reportCtx ? extractReportComment(ticket.message) : null;
  const { conversationTitle, messagePreview } = resolveReportDisplayLabels(ticket);
  const chatLink = reportCtx ? buildReportedMessageChatLink(reportCtx) : null;

  function openReportedMessage() {
    if (!chatLink) return;
    navigate(chatLink);
  }

  function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!isOnline || !canReply) return;
    setReplyError('');
    replyMutation.mutate();
  }

  return (
    <div className="page-container max-w-lg">
      <div className="mb-6">
        <BackLink label={backLabel} fallbackTo={listFallback} className="mb-0" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-h1 flex-1">{ticket.subject}</h1>
        <SupportTicketStatusBadge status={ticket.status} />
      </div>

      {canViewReport && reportCtx && chatLink ? (
        <Card
          interactive
          role="link"
          tabIndex={0}
          aria-label="Открыть сообщение в чате"
          className="mb-4 border-danger/40 bg-danger-muted/15"
          onClick={openReportedMessage}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openReportedMessage();
            }
          }}
        >
          <div className="mb-3 flex items-center gap-2">
            <MessageSquareWarning className="h-4 w-4 shrink-0 text-danger" aria-hidden />
            <h2 className="text-label uppercase tracking-wide text-danger">Жалоба на сообщение</h2>
          </div>
          <dl className="mb-4 space-y-3 text-body-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-text-muted">Категория</dt>
              <dd>{SUPPORT_CATEGORY_LABELS[ticket.category]}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-text-muted">Создано</dt>
              <dd>{format(new Date(ticket.createdAt), 'dd.MM.yyyy HH:mm')}</dd>
            </div>
            <div>
              <dt className="text-caption text-text-muted">Причина</dt>
              <dd className="mt-0.5 font-medium">{MESSAGE_REPORT_REASON_LABELS[reportCtx.reason]}</dd>
            </div>
            <div>
              <dt className="text-caption text-text-muted">Чат</dt>
              <dd className="mt-0.5 font-medium text-brand">{conversationTitle}</dd>
            </div>
            <div>
              <dt className="text-caption text-text-muted">Сообщение</dt>
              <dd className="mt-1 rounded-lg border border-danger/50 bg-surface-elevated px-3 py-2 whitespace-pre-wrap">
                {messagePreview}
              </dd>
            </div>
          </dl>
          {reportComment && (
            <p className="text-body-sm whitespace-pre-wrap">
              <span className="text-caption text-text-muted">Комментарий · </span>
              {reportComment}
            </p>
          )}
        </Card>
      ) : (
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
      )}

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
