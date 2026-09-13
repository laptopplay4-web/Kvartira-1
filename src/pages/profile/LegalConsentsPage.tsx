import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Download, FileCheck, FileWarning } from 'lucide-react';
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
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const enabled = can(user, 'legal:view-own');

  const [actionError, setActionError] = useState('');

  const {
    data: pending,
    isLoading: pendingLoading,
    error: pendingError,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ['legal', 'pending', user.id],
    queryFn: () => api.legal.getPendingConsents(user.id),
    enabled,
  });

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

  const acceptMutation = useMutation({
    mutationFn: (documentId: string) => api.legal.acceptDocument(documentId, user.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legal'] });
    },
  });

  const acceptAllMutation = useMutation({
    mutationFn: () => api.legal.acceptDocuments(pending?.map((d) => d.id) ?? [], user.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legal'] });
    },
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

  const handleAccept = (documentId: string) => {
    if (!isOnline) return;
    acceptMutation.mutate(documentId);
  };

  const handleAcceptAll = () => {
    if (!isOnline || !pending?.length) return;
    acceptAllMutation.mutate();
  };

  return (
    <div className="page-container max-w-lg">
      <BackLink label="Профиль" fallbackTo="/profile" />
      <h1 className="text-h1">Документы и согласия</h1>
      <p className="mt-2 text-body-sm text-text-secondary">
        История принятых документов. По вопросам данных — раздел «Помощь» или удаление аккаунта в
        «Настройки → Аккаунт».
      </p>

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
        <h2 className="text-h2">Требуют согласия</h2>
        {pendingLoading && (
          <div className="mt-3 space-y-3">
            <Skeleton className="h-20 rounded-xl" />
          </div>
        )}
        {pendingError && (
          <ErrorState className="mt-3" message="Не удалось загрузить" onRetry={() => refetchPending()} />
        )}
        {!pendingLoading && !pendingError && pending?.length === 0 && (
          <EmptyState
            className="mt-3 py-6"
            icon={FileCheck}
            title="Все согласия актуальны"
            description="Нет документов, ожидающих подтверждения."
          />
        )}
        {pending && pending.length > 0 && (
          <>
            {pending.length > 1 && (
              <Button
                className="mt-3"
                onClick={handleAcceptAll}
                loading={acceptAllMutation.isPending}
                disabled={!isOnline}
              >
                Принять все ({pending.length})
              </Button>
            )}
            <div className="mt-3 space-y-3">
              {pending.map((doc) => (
                <Card key={doc.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <FileWarning className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <Link to={`/legal/${doc.id}`} className="font-medium hover:text-brand">
                        {doc.title}
                      </Link>
                      <p className="text-caption text-text-muted">Версия {doc.currentVersion}</p>
                    </div>
                  </div>
                  <Button
                    className="mt-3 w-full"
                    size="sm"
                    onClick={() => handleAccept(doc.id)}
                    loading={acceptMutation.isPending && acceptMutation.variables === doc.id}
                    disabled={!isOnline}
                  >
                    Принять
                  </Button>
                </Card>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-h2">История согласий</h2>
        {consentsLoading && (
          <div className="mt-3 space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        )}
        {consentsError && (
          <ErrorState className="mt-3" message="Не удалось загрузить историю" onRetry={() => refetchConsents()} />
        )}
        {!consentsLoading && !consentsError && consents?.length === 0 && (
          <EmptyState
            className="mt-3 py-6"
            title="История пуста"
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
        <h2 className="text-h2">Персональные данные</h2>
        <p className="text-body-sm text-text-secondary">
          Право на доступ к своим данным (152-ФЗ). Удаление аккаунта — в настройках аккаунта.
        </p>
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
