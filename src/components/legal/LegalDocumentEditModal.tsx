import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { LegalDocument } from '@/types';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

interface LegalDocumentEditModalProps {
  open: boolean;
  onClose: () => void;
  adminId: string;
  document: LegalDocument;
  onSaved: () => void;
}

export function LegalDocumentEditModal({
  open,
  onClose,
  adminId,
  document,
  onSaved,
}: LegalDocumentEditModalProps) {
  const isOnline = useOnlineStatus();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [requiresConsent, setRequiresConsent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle(document.title);
    setContent(document.content);
    setRequiresConsent(document.requiresConsent);
    setError('');
  }, [open, document]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.legal.updateDocument(
        document.id,
        { title, content, requiresConsent },
        adminId,
      ),
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить документ');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isOnline) return;
    setError('');
    saveMutation.mutate();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Редактировать документ"
      size="lg"
      footer={
        <div className="flex gap-2">
          <Button type="button" variant="ghost" className="flex-1 min-h-11" onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="submit"
            form="legal-edit-form"
            className="flex-1 min-h-11"
            loading={saveMutation.isPending}
            disabled={!isOnline}
          >
            Сохранить
          </Button>
        </div>
      }
    >
      <form id="legal-edit-form" onSubmit={handleSubmit} className="space-y-4">
        {!isOnline && (
          <p className="text-body-sm text-warning" role="alert">
            {OFFLINE_NETWORK_MESSAGE}
          </p>
        )}
        <Input label="Название" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <div>
          <label className="mb-1.5 block text-label text-text-secondary">Текст документа</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            required
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-body focus-ring"
          />
        </div>
        <label className="flex items-center gap-2 text-body-sm">
          <input
            type="checkbox"
            checked={requiresConsent}
            onChange={(e) => setRequiresConsent(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Требует согласия пользователя
        </label>
        <p className="text-caption text-text-muted">
          Текущая версия: v{document.currentVersion}. Для существенных изменений используйте публикацию новой версии.
        </p>
        {error && (
          <p className="text-body-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
