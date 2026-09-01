import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BackLink } from '@/components/ui/BackLink';
import { format } from 'date-fns';
import { api } from '@/services/api';
import { LEGAL_DOCUMENT_TYPE_LABELS } from '@/services/legal/constants';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Logo } from '@/components/ui/Logo';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCurrentUser } from '@/stores/authStore';

export default function LegalDocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useCurrentUser();

  const { data: doc, isLoading, error, refetch } = useQuery({
    queryKey: ['legal', 'document', id],
    queryFn: () => api.legal.getDocument(id!),
    enabled: !!id,
  });

  return (
    <div className="min-h-dvh">
      <header className="border-b border-border-subtle px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <BackLink label="Документы" fallbackTo="/legal" className="mb-0 flex items-center gap-1 text-sm focus-ring rounded" />
          <Logo size="sm" />
          {user ? (
            <Link to="/profile/legal" className="text-sm text-brand hover:underline">
              Согласия
            </Link>
          ) : (
            <span className="w-16" aria-hidden />
          )}
        </div>
      </header>

      <main className="page-container max-w-2xl py-8">
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-48 w-full" />
          </div>
        )}

        {error && (
          <ErrorState message="Не удалось загрузить документ" onRetry={() => refetch()} />
        )}

        {doc && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">{LEGAL_DOCUMENT_TYPE_LABELS[doc.type]}</Badge>
              <span className="text-caption text-text-muted">v{doc.currentVersion}</span>
              {doc.requiresConsent && <Badge variant="warning">Требует согласия</Badge>}
            </div>
            <h1 className="mt-3 text-h1">{doc.title}</h1>
            <p className="mt-1 text-caption text-text-muted">
              Действует с {format(new Date(doc.effectiveAt), 'dd.MM.yyyy')}
            </p>

            <Card className="mt-6 whitespace-pre-wrap text-body-sm leading-relaxed">
              {doc.content}
            </Card>

            {doc.versionHistory.length > 0 && (
              <section className="mt-8">
                <h2 className="text-h2">История версий</h2>
                <div className="mt-3 space-y-3">
                  {doc.versionHistory.map((entry) => (
                    <Card key={entry.version} className="p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">Версия {entry.version}</span>
                        <span className="text-caption text-text-muted">
                          {format(new Date(entry.effectiveAt), 'dd.MM.yyyy')}
                        </span>
                      </div>
                      <p className="mt-2 text-body-sm text-text-secondary">{entry.changeSummary}</p>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
