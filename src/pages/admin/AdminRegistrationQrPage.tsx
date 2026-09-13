import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Download, Printer, RefreshCw } from 'lucide-react';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { useCurrentUser } from '@/stores/authStore';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { AdminPageHeader } from '@/components/ui/AdminPageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  downloadDataUrl,
  renderRegistrationQrPngDataUrl,
  renderRegistrationQrSvgDataUrl,
} from '@/services/registration/qr';
import { resolveAppOrigin } from '@/services/registration/invite';
import { formatFullDate } from '@/utils/dates';

export default function AdminRegistrationQrPage() {
  const user = useCurrentUser()!;
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const origin = resolveAppOrigin();
  const [qrSrc, setQrSrc] = useState('');
  const [qrError, setQrError] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [actionError, setActionError] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['registration-invite', 'admin', user.id, origin],
    queryFn: () => api.schoolSettings.getRegistrationInvite(user.id, origin),
  });

  useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!data?.registerUrl) {
        setQrSrc('');
        return;
      }
      try {
        const src = await renderRegistrationQrSvgDataUrl(data.registerUrl, 360);
        if (!cancelled) {
          setQrSrc(src);
          setQrError('');
        }
      } catch {
        if (!cancelled) {
          setQrSrc('');
          setQrError('Не удалось сгенерировать QR');
        }
      }
    }
    void render();
    return () => {
      cancelled = true;
    };
  }, [data?.registerUrl]);

  const rotateMutation = useMutation({
    mutationFn: () => api.schoolSettings.rotateRegistrationInvite(user.id, origin),
    onSuccess: (next) => {
      setActionError('');
      setConfirmRotate(false);
      queryClient.setQueryData(['registration-invite', 'admin', user.id, origin], next);
      void queryClient.invalidateQueries({ queryKey: ['registration-invite'] });
    },
    onError: (err) => {
      setActionError(err instanceof ApiError ? err.message : 'Не удалось обновить QR');
    },
  });

  const handleCopy = async () => {
    if (!data?.registerUrl) return;
    try {
      await navigator.clipboard.writeText(data.registerUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setActionError('Не удалось скопировать ссылку');
    }
  };

  const handleDownload = async () => {
    if (!data?.registerUrl) return;
    try {
      const png = await renderRegistrationQrPngDataUrl(data.registerUrl, 1200);
      downloadDataUrl('kvartira-registration-qr.png', png);
    } catch {
      setActionError('Не удалось скачать PNG');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="page-container max-w-lg">
      <AdminPageHeader title="QR регистрации" />
      <p className="mb-6 text-body-sm text-text-secondary">
        Распечатайте код и разместите в школе. Ссылка ведёт сразу на форму создания аккаунта.
        Регистрация без этого QR закрыта.
      </p>

      {isLoading && (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="mx-auto h-64 w-64 rounded-2xl" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {error && (
        <ErrorState
          title="Не удалось загрузить QR"
          message="Проверьте сеть и права администратора"
          onRetry={() => void refetch()}
        />
      )}

      {data && !isLoading && (
        <div className="space-y-4">
          <Card className="print-qr-card flex flex-col items-center gap-4 p-6">
            {qrSrc && (
              <div className="rounded-2xl bg-white p-4 shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-transform duration-500 ease-out will-change-transform hover:scale-[1.02]">
                <img
                  src={qrSrc}
                  alt="QR-код регистрации"
                  width={360}
                  height={360}
                  className="h-64 w-64"
                />
              </div>
            )}
            {!qrSrc && !qrError && <Skeleton className="h-64 w-64 rounded-xl" />}
            {qrError && (
              <p className="text-sm text-danger" role="alert">
                {qrError}
              </p>
            )}
            <div className="text-center">
              <p className="text-h3">Квартира</p>
              <p className="mt-1 text-body-sm text-text-secondary">
                Сканируйте для регистрации ученика
              </p>
              <p className="mt-2 text-caption text-text-muted">
                Обновлён:{' '}
                {data.rotatedAt ? formatFullDate(data.rotatedAt) : '—'}
              </p>
            </div>
            <p className="break-all text-center text-caption text-text-muted print:hidden">
              {data.registerUrl}
            </p>
          </Card>

          <div className="grid grid-cols-2 gap-2 print:hidden">
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              onClick={() => void handleCopy()}
            >
              <Copy className="mr-2 h-4 w-4" aria-hidden />
              {copied ? 'Скопировано' : 'Ссылка'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              onClick={() => void handleDownload()}
            >
              <Download className="mr-2 h-4 w-4" aria-hidden />
              PNG
            </Button>
            <Button type="button" variant="secondary" className="min-h-11" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" aria-hidden />
              Печать
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-11"
              disabled={!isOnline || rotateMutation.isPending}
              onClick={() => setConfirmRotate(true)}
            >
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
              Новый QR
            </Button>
          </div>

          {!isOnline && (
            <p className="text-sm text-warning print:hidden" role="status">
              {OFFLINE_NETWORK_MESSAGE}
            </p>
          )}
          {actionError && (
            <p className="text-sm text-danger print:hidden" role="alert">
              {actionError}
            </p>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmRotate}
        onClose={() => setConfirmRotate(false)}
        title="Обновить QR-код?"
        description="Старый распечатанный код перестанет открывать регистрацию. Потребуется новая печать."
        confirmLabel="Обновить"
        tone="destructive"
        loading={rotateMutation.isPending}
        disabled={!isOnline}
        onConfirm={() => rotateMutation.mutate()}
      />

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-qr-card, .print-qr-card * { visibility: visible !important; }
          .print-qr-card {
            position: fixed;
            inset: 0;
            margin: auto;
            width: 90mm;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            color: black !important;
          }
        }
      `}</style>
    </div>
  );
}
