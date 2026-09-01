import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import type { LegalDocument } from '@/types';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { bumpLegalVersion } from '@/services/legal/helpers';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

interface LegalPublishVersionModalProps {
  open: boolean;
  onClose: () => void;
  adminId: string;
  document: LegalDocument;
  onSaved: () => void;
}

function todayISO() {
  return format(new Date(), 'yyyy-MM-dd');
}

export function LegalPublishVersionModal({
  open,
  onClose,
  adminId,
  document,
  onSaved,
}: LegalPublishVersionModalProps) {
  const isOnline = useOnlineStatus();
  const suggestedVersion = bumpLegalVersion(document.currentVersion);
  const [content, setContent] = useState('');
  const [changeSummary, setChangeSummary] = useState('');
  const [effectiveAt, setEffectiveAt] = useState(todayISO());
  const [version, setVersion] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setContent(document.content);
    setChangeSummary('');
    setEffectiveAt(todayISO());
    setVersion(suggestedVersion);
    setError('');
  }, [open, document, suggestedVersion]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.legal.publishVersion(
        document.id,
        {
          content,
          changeSummary,
          effectiveAt,
          version: version.trim() || undefined,
        },
        adminId,
      ),
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Не удалось опубликовать версию');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isOnline) return;
    setError('');
    saveMutation.mutate();
  }

  return (
    <Modal open={open} onClose={onClose} title="Новая версия документа">
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isOnline && (
          <p className="text-body-sm text-warning" role="alert">
            {OFFLINE_NETWORK_MESSAGE}
          </p>
        )}
        <p className="text-body-sm text-text-secondary">
          Текущая версия v{document.currentVersion}. После публикации пользователям с устаревшим согласием потребуется повторное принятие.
        </p>
        <Input
          label="Версия"
          hint="Формат X.Y"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          required
        />
        <Input
          label="Дата вступления в силу"
          type="date"
          value={effectiveAt}
          onChange={(e) => setEffectiveAt(e.target.value)}
          required
        />
        <Input
          label="Описание изменений"
          value={changeSummary}
          onChange={(e) => setChangeSummary(e.target.value)}
          required
        />
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
            Опубликовать
          </Button>
        </div>
      </form>
    </Modal>
  );
}
