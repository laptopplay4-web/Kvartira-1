import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, FileText } from 'lucide-react';
import { BackLink } from '@/components/ui/BackLink';
import { format } from 'date-fns';
import { api } from '@/services/api';
import { LEGAL_DOCUMENT_TYPE_LABELS } from '@/services/legal/constants';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Logo } from '@/components/ui/Logo';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCurrentUser } from '@/stores/authStore';

export default function LegalDocumentsPage() {
  const user = useCurrentUser();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['legal', 'documents'],
    queryFn: () => api.legal.getDocuments(),
  });

  return (
    <div className="min-h-dvh">
      <header className="border-b border-border-subtle px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <BackLink
            label={user ? 'Профиль' : 'Главная'}
            fallbackTo={user ? '/profile' : '/'}
            className="mb-0"
          />
          <Logo size="sm" />
          {user ? (
            <Link to="/profile/legal" className="text-sm text-brand hover:underline">
              Мои согласия
            </Link>
          ) : (
            <Link to="/login" className="text-sm text-brand hover:underline">
              Войти
            </Link>
          )}
        </div>
      </header>

      <main className="page-container max-w-2xl py-8">
        <h1 className="text-h1">Документы</h1>
        <p className="mt-2 text-body-sm text-text-secondary">
          Юридические документы школы. Тексты требуют проверки перед публикацией.
        </p>

        {isLoading && (
          <div className="mt-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        )}

        {error && (
          <ErrorState className="mt-6" message="Не удалось загрузить документы" onRetry={() => refetch()} />
        )}

        {!isLoading && !error && data?.length === 0 && (
          <EmptyState className="mt-6" icon={FileText} title="Документы не найдены" />
        )}

        {data && data.length > 0 && (
          <div className="mt-6 space-y-3">
            {data.map((doc) => (
              <Link key={doc.id} to={`/legal/${doc.id}`}>
                <Card interactive className="flex items-center gap-3">
                  <FileText className="h-5 w-5 shrink-0 text-brand" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{doc.title}</p>
                    <p className="text-caption text-text-muted">
                      {LEGAL_DOCUMENT_TYPE_LABELS[doc.type]} · v{doc.currentVersion} ·{' '}
                      {format(new Date(doc.effectiveAt), 'dd.MM.yyyy')}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
                </Card>
              </Link>
            ))}
          </div>
        )}

        {!user && (
          <div className="mt-8 text-center">
            <Link to="/register">
              <Button>Зарегистрироваться</Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
