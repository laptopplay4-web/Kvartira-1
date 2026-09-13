import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ExternalLink, FileText, GitBranch, Pencil } from 'lucide-react';
import { api } from '@/services/api';
import { LEGAL_DOCUMENT_TYPE_LABELS } from '@/services/legal/constants';
import { useCurrentUser } from '@/stores/authStore';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { AdminPageHeader } from '@/components/ui/AdminPageHeader';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { LegalDocumentEditModal } from '@/components/legal/LegalDocumentEditModal';
import { LegalPublishVersionModal } from '@/components/legal/LegalPublishVersionModal';
import type { LegalDocument } from '@/types';

export default function AdminLegalPage() {
  const user = useCurrentUser()!;
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const [editingDoc, setEditingDoc] = useState<LegalDocument | undefined>();
  const [publishingDoc, setPublishingDoc] = useState<LegalDocument | undefined>();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['legal', 'documents'],
    queryFn: () => api.legal.getDocuments(),
  });

  function invalidateLegal() {
    void queryClient.invalidateQueries({ queryKey: ['legal'] });
  }

  if (error) {
    return (
      <div className="page-container">
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="page-container">
      <AdminPageHeader title="Юридические документы" />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : data?.length === 0 ? (
        <EmptyState icon={FileText} title="Документы не найдены" className="py-8" />
      ) : (
        <div className="space-y-3">
          {data?.map((doc) => (
            <Card key={doc.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{doc.title}</p>
                    {doc.requiresConsent && <Badge variant="warning">Согласие</Badge>}
                  </div>
                  <p className="mt-1 text-caption text-text-muted">
                    {LEGAL_DOCUMENT_TYPE_LABELS[doc.type]} · v{doc.currentVersion} ·{' '}
                    {format(new Date(doc.effectiveAt), 'dd.MM.yyyy')}
                  </p>
                  <p className="mt-2 line-clamp-2 text-body-sm text-text-secondary">{doc.content}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Link
                    to={`/legal/${doc.id}`}
                    aria-label="Открыть публичную страницу"
                    className="rounded-lg p-2 text-text-muted hover:text-brand focus-ring min-h-11 min-w-11"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden />
                  </Link>
                  <button
                    type="button"
                    aria-label="Редактировать документ"
                    disabled={!isOnline}
                    className="rounded-lg p-2 text-text-muted hover:text-brand focus-ring min-h-11 min-w-11 disabled:opacity-50"
                    onClick={() => setEditingDoc(doc)}
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label="Опубликовать новую версию"
                    disabled={!isOnline}
                    className="rounded-lg p-2 text-text-muted hover:text-brand focus-ring min-h-11 min-w-11 disabled:opacity-50"
                    onClick={() => setPublishingDoc(doc)}
                  >
                    <GitBranch className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editingDoc && (
        <LegalDocumentEditModal
          open={!!editingDoc}
          onClose={() => setEditingDoc(undefined)}
          adminId={user.id}
          document={editingDoc}
          onSaved={invalidateLegal}
        />
      )}

      {publishingDoc && (
        <LegalPublishVersionModal
          open={!!publishingDoc}
          onClose={() => setPublishingDoc(undefined)}
          adminId={user.id}
          document={publishingDoc}
          onSaved={invalidateLegal}
        />
      )}
    </div>
  );
}
