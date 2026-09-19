import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2 } from 'lucide-react';
import { api } from '@/services/api';
import { getYclientsApi } from '@/services/api/yclientsClient';
import { ApiError } from '@/services/api/types';
import { useCurrentUser } from '@/stores/authStore';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { isPocketBaseMode } from '@/services/api/pocketbase/client';
import { AdminPageHeader } from '@/components/ui/AdminPageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import type { YclientsMappings } from '@/services/yclients/types';
import { EMPTY_YCLIENTS_MAPPINGS } from '@/services/yclients/types';
import { formatUserName } from '@/utils';
import { isYclientsLessonsEnabled } from '@/config/features';

const ycApi = getYclientsApi();

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Не удалось загрузить данные';
}

export default function AdminYclientsPage() {
  const user = useCurrentUser()!;
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const [draft, setDraft] = useState<YclientsMappings>({
    directionToServiceIds: {},
    staffToUserId: {},
  });
  const [saveError, setSaveError] = useState('');
  const [saveOk, setSaveOk] = useState(false);

  const statusQuery = useQuery({
    queryKey: ['yclients', 'status'],
    queryFn: () => ycApi.getStatus(),
    retry: 1,
  });

  const mappingsQuery = useQuery({
    queryKey: ['yclients', 'mappings'],
    queryFn: () => ycApi.getMappings(),
    retry: 1,
  });

  const servicesQuery = useQuery({
    queryKey: ['yclients', 'services'],
    queryFn: () => ycApi.getServices(),
    enabled: Boolean(statusQuery.data?.configured),
  });

  const staffQuery = useQuery({
    queryKey: ['yclients', 'staff'],
    queryFn: () => ycApi.getStaff(),
    enabled: Boolean(statusQuery.data?.configured),
  });

  const directionsQuery = useQuery({
    queryKey: ['directions'],
    queryFn: () => api.lessons.getDirections(),
  });

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => api.users.getAllUsers(user.id),
  });

  useEffect(() => {
    if (mappingsQuery.data) {
      setDraft(mappingsQuery.data);
    } else if (mappingsQuery.isError) {
      setDraft({
        directionToServiceIds: { ...EMPTY_YCLIENTS_MAPPINGS.directionToServiceIds },
        staffToUserId: { ...EMPTY_YCLIENTS_MAPPINGS.staffToUserId },
      });
    }
  }, [mappingsQuery.data, mappingsQuery.isError]);

  const teachers = useMemo(
    () => (usersQuery.data ?? []).filter((u) => u.role === 'teacher' || u.role === 'admin'),
    [usersQuery.data],
  );

  const saveMutation = useMutation({
    mutationFn: () => ycApi.updateMappings(draft),
    onSuccess: (saved) => {
      setDraft(saved);
      setSaveOk(true);
      setSaveError('');
      void queryClient.invalidateQueries({ queryKey: ['yclients'] });
    },
    onError: (err) => {
      setSaveOk(false);
      setSaveError(errorMessage(err));
    },
  });

  function setDirectionService(directionId: string, serviceId: string) {
    const id = Number(serviceId);
    setDraft((prev) => {
      const next = { ...prev, directionToServiceIds: { ...prev.directionToServiceIds } };
      if (!serviceId || !Number.isFinite(id) || id <= 0) {
        delete next.directionToServiceIds[directionId];
      } else {
        next.directionToServiceIds[directionId] = [id];
      }
      return next;
    });
    setSaveOk(false);
  }

  function setStaffUser(staffId: string, userId: string) {
    setDraft((prev) => {
      const next = { ...prev, staffToUserId: { ...prev.staffToUserId } };
      if (!userId) delete next.staffToUserId[staffId];
      else next.staffToUserId[staffId] = userId;
      return next;
    });
    setSaveOk(false);
  }

  const loadHint = mappingsQuery.isError
    ? errorMessage(mappingsQuery.error)
    : statusQuery.isError
      ? errorMessage(statusQuery.error)
      : null;

  return (
    <div className="page-container max-w-lg">
      <AdminPageHeader title="YCLIENTS" />

      <Card className="mb-4 space-y-2 text-body-sm">
        <p className="font-medium">Статус</p>
        {statusQuery.isLoading ? (
          <Skeleton className="h-4 w-48" />
        ) : (
          <>
            <p className="text-text-secondary">
              Режим API:{' '}
              {isPocketBaseMode() ? (
                <span className="text-brand">pocketbase</span>
              ) : (
                <span>mock (связки только локально)</span>
              )}
            </p>
            <p className="text-text-secondary">
              YCLIENTS API:{' '}
              {statusQuery.data?.configured ? (
                <span className="text-brand">настроен</span>
              ) : (
                <span className="text-danger">нет ключей на сервере</span>
              )}
            </p>
            {!statusQuery.data?.configured && (
              <p className="text-caption text-text-muted">
                Впишите YCLIENTS_COMPANY_ID и YCLIENTS_PARTNER_TOKEN в корневой .env (или
                pocketbase/yclients.env), остановите pocketbase.exe и запустите{' '}
                <code className="text-primary">npm run pb:serve</code>. Ключи —{' '}
                <a
                  className="text-brand underline"
                  href="https://developers.yclients.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  developers.yclients.com
                </a>
                .
              </p>
            )}
            <p className="text-text-secondary">
              Занятия:{' '}
              {isYclientsLessonsEnabled() ? (
                <span className="text-brand">yclients</span>
              ) : (
                <span>native</span>
              )}
            </p>
            {!statusQuery.data?.userTokenSet && isPocketBaseMode() && (
              <p className="text-caption text-text-muted">
                Для отмены записей нужен YCLIENTS_USER_TOKEN.
              </p>
            )}
            {isPocketBaseMode() && loadHint && (
              <p className="text-caption text-danger" role="alert">
                {loadHint}
                {' — '}
                перезапустите PocketBase с актуальными pb_hooks (файл yclients.pb.js).
              </p>
            )}
          </>
        )}
      </Card>

      {mappingsQuery.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-h3">
              <Link2 className="h-4 w-4" aria-hidden />
              Направления → услуги
            </h2>
            {!statusQuery.data?.configured && isPocketBaseMode() && (
              <p className="mb-3 text-body-sm text-text-muted">
                Список услуг появится после YCLIENTS_COMPANY_ID + YCLIENTS_PARTNER_TOKEN и
                перезапуска PB. Связки можно сохранить заранее, указав id услуги вручную позже.
              </p>
            )}
            <div className="space-y-3">
              {(directionsQuery.data ?? []).map((dir) => {
                const current = draft.directionToServiceIds[dir.id]?.[0];
                return (
                  <Card key={dir.id} className="space-y-2">
                    <p className="font-medium">{dir.name}</p>
                    <select
                      className="w-full min-h-11 rounded-lg border border-border bg-surface-elevated px-3 text-sm"
                      value={current ? String(current) : ''}
                      onChange={(e) => setDirectionService(dir.id, e.target.value)}
                      disabled={!isOnline}
                    >
                      <option value="">— не связано —</option>
                      {(servicesQuery.data ?? []).map((svc) => (
                        <option key={svc.id} value={svc.id}>
                          {svc.title} ({svc.durationMinutes} мин)
                        </option>
                      ))}
                    </select>
                  </Card>
                );
              })}
              {(directionsQuery.data ?? []).length === 0 && (
                <p className="text-body-sm text-text-muted">Сначала создайте направления.</p>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-h3">Сотрудники → преподаватели</h2>
            <div className="space-y-3">
              {(staffQuery.data ?? []).map((staff) => (
                <Card key={staff.id} className="space-y-2">
                  <p className="font-medium">{staff.name}</p>
                  <select
                    className="w-full min-h-11 rounded-lg border border-border bg-surface-elevated px-3 text-sm"
                    value={draft.staffToUserId[String(staff.id)] ?? ''}
                    onChange={(e) => setStaffUser(String(staff.id), e.target.value)}
                    disabled={!isOnline}
                  >
                    <option value="">— без привязки —</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {formatUserName(t)} ({t.role})
                      </option>
                    ))}
                  </select>
                </Card>
              ))}
              {statusQuery.data?.configured && (staffQuery.data ?? []).length === 0 && (
                <p className="text-body-sm text-text-muted">Сотрудники не загружены.</p>
              )}
              {!statusQuery.data?.configured && (
                <p className="text-body-sm text-text-muted">
                  Сотрудники подтянутся из YCLIENTS после настройки ключей.
                </p>
              )}
            </div>
          </section>

          {saveError && (
            <p className="text-body-sm text-danger" role="alert">
              {saveError}
            </p>
          )}
          {saveOk && <p className="text-body-sm text-brand">Сохранено</p>}

          <Button
            fullWidth
            disabled={!isOnline || saveMutation.isPending || Boolean(mappingsQuery.isError && isPocketBaseMode())}
            onClick={() => {
              if (!isOnline) {
                setSaveError(OFFLINE_NETWORK_MESSAGE);
                return;
              }
              saveMutation.mutate();
            }}
          >
            {saveMutation.isPending ? 'Сохранение…' : 'Сохранить связки'}
          </Button>
          {mappingsQuery.isError && isPocketBaseMode() && (
            <Button
              fullWidth
              variant="secondary"
              onClick={() => {
                void statusQuery.refetch();
                void mappingsQuery.refetch();
              }}
            >
              Повторить загрузку
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
