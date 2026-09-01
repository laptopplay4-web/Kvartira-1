import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { HelpArticle, SupportTicketCategory } from '@/types';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { SUPPORT_CATEGORY_LABELS, parseFaqKeywords } from '@/services/support/helpers';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

const CATEGORY_OPTIONS: { value: SupportTicketCategory; label: string }[] = (
  Object.entries(SUPPORT_CATEGORY_LABELS) as [SupportTicketCategory, string][]
).map(([value, label]) => ({ value, label }));

interface FaqArticleModalProps {
  open: boolean;
  onClose: () => void;
  adminId: string;
  article?: HelpArticle;
  onSaved: () => void;
}

export function FaqArticleModal({ open, onClose, adminId, article, onSaved }: FaqArticleModalProps) {
  const isOnline = useOnlineStatus();
  const isEdit = !!article;
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [category, setCategory] = useState<SupportTicketCategory>('other');
  const [keywords, setKeywords] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setQuestion(article?.question ?? '');
    setAnswer(article?.answer ?? '');
    setCategory(article?.category ?? 'other');
    setKeywords(article?.keywords.join(', ') ?? '');
    setError('');
  }, [open, article]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        question,
        answer,
        category,
        keywords: parseFaqKeywords(keywords),
      };
      return isEdit
        ? api.support.updateFaqArticle(article!.id, payload, adminId)
        : api.support.createFaqArticle(payload, adminId);
    },
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить статью');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isOnline) return;
    setError('');
    saveMutation.mutate();
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Редактировать вопрос' : 'Новый вопрос FAQ'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isOnline && (
          <p className="text-body-sm text-warning" role="alert">
            {OFFLINE_NETWORK_MESSAGE}
          </p>
        )}
        <Input label="Вопрос" value={question} onChange={(e) => setQuestion(e.target.value)} required />
        <div>
          <label className="mb-1.5 block text-label text-text-secondary">Ответ</label>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={5}
            required
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-body focus-ring"
          />
        </div>
        <div>
          <label htmlFor="faq-category" className="mb-1.5 block text-label text-text-secondary">
            Категория
          </label>
          <select
            id="faq-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as SupportTicketCategory)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-body focus-ring min-h-11"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="Ключевые слова"
          hint="Через запятую, для поиска"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
        />
        {error && (
          <p className="text-body-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" className="flex-1 min-h-11" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" className="flex-1 min-h-11" loading={saveMutation.isPending} disabled={!isOnline}>
            {isEdit ? 'Сохранить' : 'Добавить'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
