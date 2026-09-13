import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ChevronRight, Download } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { can } from '@/permissions';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { isConsentActive } from '@/services/legal/helpers';
import {
  downloadPersonalDataExport,
  personalDataExportFilename,
} from '@/services/profile/dataExport';
import { useCurrentUser } from '@/stores/authStore';

export default function LegalConsentsPage() {
  const user = useCurrentUser()!;
  const isOnline = useOnlineStatus();
  const enabled = can(user, 'legal:view-own');

  const [actionError, setActionError] = useState('');

  const {
    data: consents,
    isLoading: consentsLoading,
    error: consentsError,
    refetch: refetchConsents,
  } = useQuery({
    queryKey: ['legal', 'consents', user.id],
    queryFn: () => api.legal.getUserConsents(user.id),
    enabled,
  });

  const exportMutation = useMutation({
    mutationFn: () => api.users.exportOwnData(user.id),
    onSuccess: (data) => {
      downloadPersonalDataExport(data, personalDataExportFilename());
      setActionError('');
    },
    onError: (e) => {
      setActionError(e instanceof ApiError ? e.message : 'Не удалось выгрузить данные');
    },
  });

  return (
    <div className="page-container max-w-lg">
      <BackLink label="Профиль" fallbackTo="/profile" />
      <h1 className="text-h1">Документы и согласия</h1>

      <Link to="/legal" className="mt-4 inline-flex items-center gap-1 text-sm text-brand hover:underline">
        Все документы
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Link>

      {!isOnline && (
        <p className="mt-4 rounded-lg bg-warning/10 px-4 py-3 text-sm text-warning" role="status">
          {OFFLINE_NETWORK_MESSAGE}
        </p>
      )}

      {actionError && (
        <p className="mt-4 rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {actionError}
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-h2">Принятые согласия</h2>
        {consentsLoading && (
          <div className="mt-3 space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        )}
        {consentsError && (
          <ErrorState
            className="mt-3"
            message="Не удалось загрузить согласия"
            onRetry={() => refetchConsents()}
          />
        )}
        {!consentsLoading && !consentsError && consents?.length === 0 && (
          <EmptyState
            className="mt-3 py-6"
            title="Пока пусто"
            description="Согласия появятся после принятия документов."
          />
        )}
        {consents && consents.length > 0 && (
          <div className="mt-3 space-y-2">
            {consents.map((consent) => {
              const active = isConsentActive(consent);
              return (
                <Card key={consent.id} className="p-4">
                  <p className="font-medium">{consent.documentTitle}</p>
                  <p className="text-caption text-text-muted">
                    v{consent.version} · {format(new Date(consent.acceptedAt), 'dd.MM.yyyy HH:mm')}
                    {!active && consent.revokedAt
                      ? ` · отозвано ${format(new Date(consent.revokedAt), 'dd.MM.yyyy')}`
                      : ''}
                  </p>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-8 space-y-3">
        <Button
          variant="secondary"
          fullWidth
          disabled={!isOnline}
          loading={exportMutation.isPending}
          onClick={() => {
            if (!isOnline) return;
            setActionError('');
            exportMutation.mutate();
          }}
        >
          <Download className="h-4 w-4" aria-hidden />
          Скачать мои данные
        </Button>
      </section>
    </div>
  );
}
