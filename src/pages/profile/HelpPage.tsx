import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, HelpCircle, MessageSquarePlus, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { BackLink } from '@/components/ui/BackLink';
import { format } from 'date-fns';
import { useCurrentUser } from '@/stores/authStore';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { can } from '@/permissions';
import { canCreateTicket, canManageFaq } from '@/services/support/access';
import { SUPPORT_CATEGORY_LABELS } from '@/services/support/helpers';
import { MAX_ATTACHMENTS_PER_TICKET, TICKET_SEARCH_MIN_LENGTH } from '@/services/support/constants';
import { validateSupportAttachment } from '@/services/support/validation';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import type { HelpArticle, SupportTicketCategory } from '@/types';
import { readFileAsDataUrl } from '@/utils/files';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { SupportTicketStatusBadge } from '@/components/ui/SupportTicketStatusBadge';
import {
  AssignmentFilePicker,
  type PendingAssignmentFile,
} from '@/components/assignments/AssignmentFilePicker';
import {
  SupportTicketFilters,
  type SupportCategoryFilter,
  type SupportStatusFilter,
} from '@/components/support/SupportTicketFilters';
import { FaqArticleModal } from '@/components/support/FaqArticleModal';

const CATEGORY_OPTIONS: { value: SupportTicketCategory; label: string }[] = (
  Object.entries(SUPPORT_CATEGORY_LABELS) as [SupportTicketCategory, string][]
).map(([value, label]) => ({ value, label }));

export default function HelpPage() {
  const user = useCurrentUser()!;
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const [faqQuery, setFaqQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<SupportTicketCategory>('other');
  const [formError, setFormError] = useState('');
  const [attachmentError, setAttachmentError] = useState('');
  const [attachments, setAttachments] = useState<PendingAssignmentFile[]>([]);
  const [statusFilter, setStatusFilter] = useState<SupportStatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<SupportCategoryFilter>('all');
  const [ticketQuery, setTicketQuery] = useState('');
  const [faqModalOpen, setFaqModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<HelpArticle | undefined>();

  const isAdmin = can(user, 'support:view-all-tickets');
  const canEditFaq = canManageFaq(user);

  const ticketFilters = useMemo(
    () => ({
      requesterId: user.id,
      status: isAdmin && statusFilter !== 'all' ? statusFilter : undefined,
      category: isAdmin && categoryFilter !== 'all' ? categoryFilter : undefined,
      query: ticketQuery.trim().length >= TICKET_SEARCH_MIN_LENGTH ? ticketQuery.trim() : undefined,
    }),
    [user.id, isAdmin, statusFilter, categoryFilter, ticketQuery],
  );

  const {
    data: faqArticles,
    isLoading: faqLoading,
    error: faqError,
    refetch: refetchFaq,
  } = useQuery({
    queryKey: ['support', 'faq', faqQuery],
    queryFn: () => api.support.getFaqArticles(faqQuery),
    enabled: can(user, 'support:view-faq'),
  });

  const {
    data: tickets,
    isLoading: ticketsLoading,
    error: ticketsError,
    refetch: refetchTickets,
  } = useQuery({
    queryKey: ['support', 'tickets', ticketFilters],
    queryFn: () => api.support.getTickets(ticketFilters),
    enabled: can(user, 'support:view-own-tickets') || isAdmin,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.support.createTicket(
        {
          subject,
          message,
          category,
          attachments: attachments
            .filter((file) => !file.uploading && !file.error && file.url)
            .map(({ filename, mimeType, url }) => ({ filename, mimeType, url })),
        },
        user.id,
      ),
    onSuccess: () => {
      setSubject('');
      setMessage('');
      setCategory('other');
      setAttachments([]);
      setShowForm(false);
      setFormError('');
      setAttachmentError('');
      queryClient.invalidateQueries({ queryKey: ['support', 'tickets'] });
    },
    onError: (err) => {
      setFormError(err instanceof ApiError ? err.message : 'Не удалось отправить обращение');
    },
  });

  const deleteFaqMutation = useMutation({
    mutationFn: (articleId: string) => api.support.deleteFaqArticle(articleId, user.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['support', 'faq'] });
    },
  });

  const openTicketsCount = useMemo(
    () => tickets?.filter((t) => t.status === 'open').length ?? 0,
    [tickets],
  );

  const hasPendingUploads = attachments.some((file) => file.uploading);

  async function handleAttachmentFiles(files: FileList | File[]) {
    if (!isOnline) return;
    setAttachmentError('');

    for (const file of Array.from(files)) {
      if (attachments.length >= MAX_ATTACHMENTS_PER_TICKET) {
        setAttachmentError(`Максимум ${MAX_ATTACHMENTS_PER_TICKET} файла`);
        break;
      }

      const validation = validateSupportAttachment({
        filename: file.name,
        mimeType: file.type,
        size: file.size,
      });
      if (!validation.valid) {
        setAttachmentError(validation.message);
        continue;
      }

      const id = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setAttachments((prev) => [
        ...prev,
        { id, filename: file.name, mimeType: file.type, url: '', uploading: true },
      ]);

      try {
        const dataUrl = await readFileAsDataUrl(file);
        const uploaded = await api.support.uploadSupportAttachment(
          { filename: file.name, mimeType: file.type, size: file.size, dataUrl },
          user.id,
        );
        setAttachments((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, url: uploaded.url, uploading: false } : item,
          ),
        );
      } catch (e) {
        setAttachments((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  uploading: false,
                  error: e instanceof ApiError ? e.message : 'Ошибка загрузки',
                }
              : item,
          ),
        );
      }
    }
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!isOnline || hasPendingUploads) return;
    setFormError('');
    createMutation.mutate();
  }

  return (
    <div className="page-container max-w-lg">
      <div className="mb-6">
        <BackLink label="Профиль" fallbackTo="/profile" className="mb-0" />
      </div>

      <h1 className="text-h1 mb-6">Помощь</h1>

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
            aria-label="Поиск по инструкциям"
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
            title="Ничего не найдено"
            description="Попробуйте другой запрос или создайте обращение"
            className="py-8"
          />
        )}
      </section>

      <section className="mb-8" aria-labelledby="tickets-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="tickets-heading" className="text-label uppercase tracking-wide">
            {isAdmin ? 'Обращения' : 'Мои обращения'}
          </h2>
          {isAdmin && openTicketsCount > 0 && (
            <span className="text-caption text-warning">{openTicketsCount} открытых</span>
          )}
        </div>

        {isAdmin && (
          <SupportTicketFilters
            status={statusFilter}
            category={categoryFilter}
            onStatusChange={setStatusFilter}
            onCategoryChange={setCategoryFilter}
          />
        )}

        <div className="relative mb-3">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            aria-hidden
          />
          <input
            type="search"
            value={ticketQuery}
            onChange={(e) => setTicketQuery(e.target.value)}
            placeholder={`Поиск по обращениям (от ${TICKET_SEARCH_MIN_LENGTH} символов)…`}
            aria-label="Поиск по обращениям"
            className="w-full rounded-lg border border-border-subtle bg-surface py-2.5 pl-10 pr-3 text-body-sm focus-ring"
          />
        </div>

        {canCreateTicket(user) && (
          <Button
            variant="secondary"
            className="mb-3 w-full min-h-11"
            onClick={() => setShowForm((v) => !v)}
          >
            <MessageSquarePlus className="h-4 w-4" aria-hidden />
            {showForm ? 'Скрыть форму' : 'Новое обращение'}
          </Button>
        )}

        {showForm && (
          <Card className="mb-4">
            {!isOnline && (
              <p className="mb-3 text-body-sm text-warning" role="alert">
                {OFFLINE_NETWORK_MESSAGE}
              </p>
            )}
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label htmlFor="ticket-subject" className="mb-1 block text-caption text-text-muted">
                  Тема
                </label>
                <input
                  id="ticket-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={120}
                  required
                  disabled={!isOnline}
                  className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-body-sm focus-ring"
                />
              </div>
              <div>
                <label htmlFor="ticket-category" className="mb-1 block text-caption text-text-muted">
                  Категория
                </label>
                <select
                  id="ticket-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as SupportTicketCategory)}
                  disabled={!isOnline}
                  className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-body-sm focus-ring"
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ticket-message" className="mb-1 block text-caption text-text-muted">
                  Сообщение
                </label>
                <textarea
                  id="ticket-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  minLength={10}
                  required
                  disabled={!isOnline}
                  placeholder="Опишите проблему подробнее…"
                  className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-body-sm focus-ring"
                />
              </div>
              <AssignmentFilePicker
                label="Вложения"
                hint={`До ${MAX_ATTACHMENTS_PER_TICKET} файлов: изображения, документы, аудио, видео`}
                files={attachments}
                onFilesSelected={handleAttachmentFiles}
                onRemove={(id) => setAttachments((prev) => prev.filter((file) => file.id !== id))}
                disabled={!isOnline}
                error={attachmentError}
                maxFiles={MAX_ATTACHMENTS_PER_TICKET}
              />
              {formError && (
                <p className="text-body-sm text-danger" role="alert">
                  {formError}
                </p>
              )}
              <Button
                type="submit"
                className="w-full min-h-11"
                loading={createMutation.isPending}
                disabled={!isOnline || hasPendingUploads}
              >
                Отправить
              </Button>
            </form>
          </Card>
        )}

        {ticketsError ? (
          <ErrorState onRetry={() => refetchTickets()} />
        ) : ticketsLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : tickets && tickets.length > 0 ? (
          <div className="space-y-2">
            {tickets.map((ticket) => (
              <Link key={ticket.id} to={`/profile/help/${ticket.id}`}>
                <Card interactive className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{ticket.subject}</p>
                      <SupportTicketStatusBadge status={ticket.status} />
                    </div>
                    <p className="mt-1 text-caption text-text-muted">
                      {SUPPORT_CATEGORY_LABELS[ticket.category]} ·{' '}
                      {format(new Date(ticket.updatedAt), 'dd.MM.yyyy HH:mm')}
                      {ticket.attachments.length > 0 && ` · ${ticket.attachments.length} влож.`}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={MessageSquarePlus}
            title={
              ticketQuery.trim().length >= TICKET_SEARCH_MIN_LENGTH ||
              (isAdmin && (statusFilter !== 'all' || categoryFilter !== 'all'))
                ? 'Нет обращений по фильтру'
                : 'Обращений пока нет'
            }
            description={
              ticketQuery.trim().length >= TICKET_SEARCH_MIN_LENGTH ||
              (isAdmin && (statusFilter !== 'all' || categoryFilter !== 'all'))
                ? 'Измените фильтры или поиск'
                : 'Создайте обращение, если не нашли ответ в FAQ'
            }
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
