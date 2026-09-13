import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ChevronRight, HelpCircle, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { AdminPageHeader } from '@/components/ui/AdminPageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { SupportTicketStatusBadge } from '@/components/ui/SupportTicketStatusBadge';
import {
  SupportTicketFilters,
  type SupportCategoryFilter,
  type SupportStatusFilter,
} from '@/components/support/SupportTicketFilters';
import { FaqArticleModal } from '@/components/support/FaqArticleModal';
import { useCurrentUser } from '@/stores/authStore';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { can } from '@/permissions';
import { canManageFaq } from '@/services/support/access';
import { api } from '@/services/api';
import { adminHelpTicketPath, countOpenSupportTickets } from '@/services/support/adminInbox';
import { formatReportTicketListPreview } from '@/services/support/reportContext';
import { SUPPORT_CATEGORY_LABELS } from '@/services/support/helpers';
import { TICKET_SEARCH_MIN_LENGTH } from '@/services/support/constants';
import type { HelpArticle } from '@/types';

export default function AdminHelpPage() {
  const user = useCurrentUser()!;
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const [statusFilter, setStatusFilter] = useState<SupportStatusFilter>('open');
  const [categoryFilter, setCategoryFilter] = useState<SupportCategoryFilter>('all');
  const [ticketQuery, setTicketQuery] = useState('');
  const [faqQuery, setFaqQuery] = useState('');
  const [faqModalOpen, setFaqModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<HelpArticle | undefined>();

  const canInbox = can(user, 'support:view-all-tickets');
  const canEditFaq = canManageFaq(user);

  const ticketFilters = useMemo(
    () => ({
      requesterId: user.id,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      category: categoryFilter !== 'all' ? categoryFilter : undefined,
      query: ticketQuery.trim().length >= TICKET_SEARCH_MIN_LENGTH ? ticketQuery.trim() : undefined,
    }),
    [user.id, statusFilter, categoryFilter, ticketQuery],
  );

  const {
    data: tickets,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['support', 'tickets', 'admin-inbox', ticketFilters],
    queryFn: () => api.support.getTickets(ticketFilters),
    enabled: canInbox,
  });

  const { data: allTickets } = useQuery({
    queryKey: ['support', 'tickets', 'admin-open-count', user.id],
    queryFn: () => api.support.getTickets({ requesterId: user.id, status: 'open' }),
    enabled: canInbox,
  });

  const {
    data: faqArticles,
    isLoading: faqLoading,
    error: faqError,
    refetch: refetchFaq,
  } = useQuery({
    queryKey: ['support', 'faq', faqQuery],
    queryFn: () => api.support.getFaqArticles(faqQuery),
    enabled: canInbox,
  });

  const deleteFaqMutation = useMutation({
    mutationFn: (articleId: string) => api.support.deleteFaqArticle(articleId, user.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['support', 'faq'] });
    },
  });

  const openCount = countOpenSupportTickets(allTickets);

  if (!canInbox) {
    return (
      <div className="page-container max-w-lg">
        <AdminPageHeader title="Помощь" />
        <EmptyState
          icon={HelpCircle}
          title="Нет доступа"
          description="Обращения доступны только администратору"
          className="py-8"
        />
      </div>
    );
  }

  return (
    <div className="page-container max-w-lg">
      <AdminPageHeader title="Помощь" />
      <p className="mb-4 text-body-sm text-text-secondary">
        Обращения, жалобы и частые вопросы.
      </p>

      <section className="mb-8" aria-labelledby="tickets-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="tickets-heading" className="text-label uppercase tracking-wide">
            Обращения
          </h2>
          {openCount > 0 && (
            <span className="text-caption font-medium text-warning" role="status">
              {openCount} открытых
            </span>
          )}
        </div>

        <SupportTicketFilters
          status={statusFilter}
          category={categoryFilter}
          onStatusChange={setStatusFilter}
          onCategoryChange={setCategoryFilter}
        />

        <div className="relative mb-3">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            aria-hidden
          />
          <input
            type="search"
            value={ticketQuery}
            onChange={(e) => setTicketQuery(e.target.value)}
            placeholder={`Поиск (от ${TICKET_SEARCH_MIN_LENGTH} символов)…`}
            aria-label="Поиск по обращениям"
            className="w-full rounded-lg border border-border-subtle bg-surface py-2.5 pl-10 pr-3 text-body-sm focus-ring"
          />
        </div>

        {error ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : tickets && tickets.length > 0 ? (
          <div className="space-y-2">
            {tickets.map((ticket) => (
              <Link key={ticket.id} to={adminHelpTicketPath(ticket.id)}>
                <Card interactive className="flex min-h-11 items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{ticket.subject}</p>
                      <SupportTicketStatusBadge status={ticket.status} />
                      {ticket.reportContext && (
                        <span className="rounded-md bg-warning-muted px-1.5 py-0.5 text-[10px] font-medium text-warning">
                          Жалоба
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-body-sm text-text-secondary">
                      {ticket.reportContext
                        ? formatReportTicketListPreview(ticket)
                        : ticket.message}
                    </p>
                    <p className="mt-1 text-caption text-text-muted">
                      {SUPPORT_CATEGORY_LABELS[ticket.category]} ·{' '}
                      {format(new Date(ticket.updatedAt), 'dd.MM.yyyy HH:mm')}
                    </p>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-text-muted" aria-hidden />
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={HelpCircle}
            title="Нет обращений"
            description={
              statusFilter === 'open'
                ? 'Открытых запросов пока нет'
                : 'Попробуйте другой фильтр или поиск'
            }
            className="py-8"
          />
        )}
      </section>

      <section className="mb-8" aria-labelledby="faq-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="faq-heading" className="text-label uppercase tracking-wide">
            Частые вопросы
          </h2>
          {canEditFaq && (
            <Button
              variant="secondary"
              size="sm"
              className="min-h-11"
              onClick={() => {
                setEditingArticle(undefined);
                setFaqModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Добавить
            </Button>
          )}
        </div>
        <div className="relative mb-3">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            aria-hidden
          />
          <input
            type="search"
            value={faqQuery}
            onChange={(e) => setFaqQuery(e.target.value)}
            placeholder="Поиск по инструкциям…"
            aria-label="Поиск по FAQ"
            className="w-full rounded-lg border border-border-subtle bg-surface py-2.5 pl-10 pr-3 text-body-sm focus-ring"
          />
        </div>

        {faqError ? (
          <ErrorState onRetry={() => refetchFaq()} />
        ) : faqLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : faqArticles && faqArticles.length > 0 ? (
          <div className="space-y-2">
            {faqArticles.map((article) => (
              <Card key={article.id} padding="sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{article.question}</p>
                  {canEditFaq && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        aria-label="Редактировать вопрос"
                        className="rounded-lg p-2 text-text-muted hover:text-brand focus-ring min-h-11 min-w-11"
                        onClick={() => {
                          setEditingArticle(article);
                          setFaqModalOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label="Удалить вопрос"
                        className="rounded-lg p-2 text-text-muted hover:text-danger focus-ring min-h-11 min-w-11"
                        disabled={!isOnline || deleteFaqMutation.isPending}
                        onClick={() => deleteFaqMutation.mutate(article.id)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  )}
                </div>
                <p className="mt-2 text-body-sm text-text-secondary whitespace-pre-wrap">
                  {article.answer}
                </p>
                <p className="mt-2 text-caption text-text-muted">
                  {SUPPORT_CATEGORY_LABELS[article.category]}
                </p>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={HelpCircle}
            title="Нет статей"
            description="Добавьте частые вопросы для пользователей"
            className="py-8"
          />
        )}
      </section>

      <FaqArticleModal
        open={faqModalOpen}
        onClose={() => {
          setFaqModalOpen(false);
          setEditingArticle(undefined);
        }}
        adminId={user.id}
        article={editingArticle}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: ['support', 'faq'] });
        }}
      />
    </div>
  );
}
