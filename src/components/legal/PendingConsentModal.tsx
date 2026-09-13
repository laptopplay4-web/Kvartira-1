import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ConsentCheckbox } from '@/components/legal/ConsentCheckbox';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { can } from '@/permissions';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { getRegistrationConsentTitle } from '@/services/legal/helpers';
import { useCurrentUser } from '@/stores/authStore';

/**
 * Blocking gate when legal docs were updated and the user must re-accept.
 * Checkboxes stay unchecked until the user ticks them (152-ФЗ).
 */
export function PendingConsentModal() {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const enabled = !!user && can(user, 'legal:accept');

  const [acceptedIds, setAcceptedIds] = useState<Record<string, boolean>>({});
  const [invalidIds, setInvalidIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const { data: pending = [], isLoading, isFetched } = useQuery({
    queryKey: ['legal', 'pending', user?.id],
    queryFn: () => api.legal.getPendingConsents(user!.id),
    enabled,
  });

  const pendingIdsKey = pending.map((d) => d.id).join(',');

  useEffect(() => {
    setAcceptedIds({});
    setInvalidIds(new Set());
    setError('');
  }, [pendingIdsKey]);

  const allChecked = useMemo(
    () => pending.length > 0 && pending.every((doc) => !!acceptedIds[doc.id]),
    [pending, acceptedIds],
  );

  const open = enabled && isFetched && !isLoading && pending.length > 0;

  const acceptMutation = useMutation({
    mutationFn: () =>
      api.legal.acceptDocuments(
        pending.map((d) => d.id),
        user!.id,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['legal'] });
      setError('');
    },
    onError: (e) => {
      setError(e instanceof ApiError ? e.message : 'Не удалось сохранить согласия');
    },
  });

  const handleAccept = () => {
    if (!isOnline || !pending.length) return;
    const missing = pending.filter((doc) => !acceptedIds[doc.id]);
    if (missing.length > 0) {
      setInvalidIds(new Set(missing.map((d) => d.id)));
      setError('Отметьте все документы — без галочек принять нельзя');
      return;
    }
    setInvalidIds(new Set());
    acceptMutation.mutate();
  };

  if (!user || !enabled) return null;
  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={() => {}}
      title="Нужно принять обновлённые документы"
      dismissible={false}
      size="lg"
      footer={
        <Button
          fullWidth
          disabled={!isOnline || !allChecked}
          loading={acceptMutation.isPending}
          onClick={handleAccept}
        >
          Принять
        </Button>
      }
    >
      <p className="mb-4 text-body-sm text-text-secondary">
        Документы школы обновились. Откройте текст по ссылке, поставьте галочку сами и нажмите
        «Принять».
      </p>
      {!isOnline && (
        <p role="alert" className="mb-3 text-body-sm text-warning">
          {OFFLINE_NETWORK_MESSAGE}
        </p>
      )}
      <div className="space-y-3">
        {pending.map((doc) => (
          <ConsentCheckbox
            key={doc.id}
            document={doc}
            title={getRegistrationConsentTitle(doc)}
            required
            invalid={invalidIds.has(doc.id)}
            checked={!!acceptedIds[doc.id]}
            onChange={(checked) => {
              setAcceptedIds((prev) => ({ ...prev, [doc.id]: checked }));
              setInvalidIds((prev) => {
                if (!prev.has(doc.id)) return prev;
                const next = new Set(prev);
                next.delete(doc.id);
                return next;
              });
              setError('');
            }}
          />
        ))}
      </div>
      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
