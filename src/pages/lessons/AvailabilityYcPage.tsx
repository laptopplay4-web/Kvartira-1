import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { CalendarOff, Plus, Trash2 } from 'lucide-react';
import { Navigate } from 'react-router';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Toggle } from '@/components/ui/Toggle';
import { isYclientsLessonsEnabled } from '@/config/features';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { can } from '@/permissions';
import { getYclientsApi } from '@/services/api/yclientsClient';
import { ApiError } from '@/services/api/types';
import { isValidTimeRange } from '@/services/availability/validateAvailability';
import {
  createEmptyWeekTemplate,
  expandWeekTemplateToDates,
  inferExceptionsFromDates,
  inferWeekTemplateFromDates,
  scheduleHorizonRange,
  YCLIENTS_WEEKDAY_LABELS,
  YCLIENTS_WEEKDAY_ORDER,
} from '@/services/yclients/schedule';
import type {
  YclientsScheduleException,
  YclientsWeekDayTemplate,
} from '@/services/yclients/types';
import { useCurrentUser } from '@/stores/authStore';
import type { TimeRange } from '@/types';

function formatExceptionDate(date: string): string {
  try {
    return format(parseISO(date), 'd MMM yyyy', { locale: ru });
  } catch {
    return date;
  }
}

export function AvailabilityYcPage() {
  const user = useCurrentUser()!;
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();
  const [weekTemplate, setWeekTemplate] = useState<YclientsWeekDayTemplate[]>(() =>
    createEmptyWeekTemplate(),
  );
  const [exceptions, setExceptions] = useState<YclientsScheduleException[]>([]);
  const [saveError, setSaveError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [staffId, setStaffId] = useState<number | null>(null);

  const canManage = can(user, 'availability:manage');
  const horizon = scheduleHorizonRange();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['yclients', 'schedule', user.id, horizon.from, horizon.to],
    queryFn: () => getYclientsApi().getSchedule({ from: horizon.from, to: horizon.to }),
    enabled: canManage && isYclientsLessonsEnabled(),
    retry: false,
  });

  const notMapped =
    error instanceof ApiError &&
    (error.code === 'NOT_MAPPED' ||
      error.status === 404 ||
      /не связан/i.test(error.message));

  useEffect(() => {
    if (!data) return;
    setStaffId(data.staffId);
    const template = inferWeekTemplateFromDates(data.items);
    setWeekTemplate(template);
    setExceptions(inferExceptionsFromDates(data.items, template));
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const sid = staffId ?? data?.staffId;
      if (!sid) throw new ApiError('Сотрудник YCLIENTS не связан с аккаунтом', 'NOT_MAPPED', 404);
      const payload = expandWeekTemplateToDates(
        sid,
        weekTemplate,
        exceptions,
        horizon.from,
        horizon.to,
      );
      return getYclientsApi().updateSchedule(payload);
    },
    onSuccess: () => {
      setSaveError('');
      setSuccessMessage('График сохранён в YCLIENTS');
      void queryClient.invalidateQueries({ queryKey: ['yclients'] });
      void queryClient.invalidateQueries({ queryKey: ['lessons'] });
    },
    onError: (err: unknown) => {
      setSuccessMessage('');
      setSaveError(
        err instanceof ApiError ? err.message : 'Не удалось сохранить график',
      );
    },
  });

  const updateDay = (dayOfWeek: number, patch: Partial<YclientsWeekDayTemplate>) => {
    setWeekTemplate((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d)),
    );
    setSuccessMessage('');
  };

  const addBreak = (dayOfWeek: number) => {
    setWeekTemplate((prev) =>
      prev.map((d) => {
        if (d.dayOfWeek !== dayOfWeek) return d;
        return {
          ...d,
          breaks: [...d.breaks, { start: '13:00', end: '14:00' }],
        };
      }),
    );
  };

  const updateBreak = (dayOfWeek: number, index: number, patch: Partial<TimeRange>) => {
    setWeekTemplate((prev) =>
      prev.map((d) => {
        if (d.dayOfWeek !== dayOfWeek) return d;
        const breaks = d.breaks.map((b, i) => (i === index ? { ...b, ...patch } : b));
        return { ...d, breaks };
      }),
    );
  };

  const removeBreak = (dayOfWeek: number, index: number) => {
    setWeekTemplate((prev) =>
      prev.map((d) => {
        if (d.dayOfWeek !== dayOfWeek) return d;
        return { ...d, breaks: d.breaks.filter((_, i) => i !== index) };
      }),
    );
  };

  const addException = (off: boolean) => {
    const date = horizon.from;
    setExceptions((prev) => [
      ...prev,
      off
        ? { date, off: true }
        : { date, off: false, startTime: '10:00', endTime: '16:00', breaks: [] },
    ]);
  };

  const updateException = (index: number, patch: Partial<YclientsScheduleException>) => {
    setExceptions((prev) => prev.map((ex, i) => (i === index ? { ...ex, ...patch } : ex)));
    setSuccessMessage('');
  };

  const removeException = (index: number) => {
    setExceptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!isOnline) {
      setSaveError(OFFLINE_NETWORK_MESSAGE);
      return;
    }
    for (const day of weekTemplate) {
      if (!day.enabled) continue;
      if (!isValidTimeRange(day.startTime, day.endTime)) {
        setSaveError(`Некорректное время: ${YCLIENTS_WEEKDAY_LABELS[day.dayOfWeek]}`);
        return;
      }
      for (const br of day.breaks) {
        if (!isValidTimeRange(br.start, br.end)) {
          setSaveError(`Некорректный перерыв: ${YCLIENTS_WEEKDAY_LABELS[day.dayOfWeek]}`);
          return;
        }
      }
    }
    for (const ex of exceptions) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ex.date)) {
        setSaveError('Укажите дату особого дня');
        return;
      }
      if (!ex.off && ex.startTime && ex.endTime && !isValidTimeRange(ex.startTime, ex.endTime)) {
        setSaveError(`Некорректное время особого дня: ${ex.date}`);
        return;
      }
    }
    setSaveError('');
    saveMutation.mutate();
  };

  if (!canManage) {
    return <Navigate to="/lessons" replace />;
  }

  if (isLoading) {
    return (
      <div className="page-container space-y-3">
        <BackLink fallbackTo="/lessons" label="Занятия" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (notMapped) {
    return (
      <div className="page-container">
        <BackLink fallbackTo="/lessons" label="Занятия" />
        <EmptyState
          icon={CalendarOff}
          title="График недоступен"
          description="Администратор ещё не связал ваш аккаунт с сотрудником YCLIENTS."
          className="py-16"
        />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page-container">
        <BackLink fallbackTo="/lessons" label="Занятия" />
        <ErrorState
          title="Не удалось загрузить график"
          message={error instanceof ApiError ? error.message : undefined}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  return (
    <div className="page-container pb-24">
      <div className="mb-4 flex items-center justify-between gap-3">
        <BackLink fallbackTo="/lessons" label="Занятия" />
      </div>
      <header className="mb-5">
        <h1 className="text-h1">График работы</h1>
        <p className="mt-1 text-body-sm text-text-secondary">
          Синхронизация с YCLIENTS · ближайшие 8 недель
        </p>
      </header>

      <div className="space-y-3">
        {YCLIENTS_WEEKDAY_ORDER.map((dow) => {
          const day = weekTemplate.find((d) => d.dayOfWeek === dow)!;
          return (
            <Card key={dow} padding="sm" className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-body font-medium text-text-primary">
                  {YCLIENTS_WEEKDAY_LABELS[dow]}
                </span>
                <Toggle
                  checked={day.enabled}
                  onChange={(enabled) => updateDay(dow, { enabled })}
                  label={`${YCLIENTS_WEEKDAY_LABELS[dow]}: рабочий день`}
                  id={`yc-day-${dow}`}
                />
              </div>
              {day.enabled && (
                <div className="space-y-3 border-t border-border-subtle pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="time"
                      label="С"
                      value={day.startTime}
                      onChange={(e) => updateDay(dow, { startTime: e.target.value })}
                    />
                    <Input
                      type="time"
                      label="До"
                      value={day.endTime}
                      onChange={(e) => updateDay(dow, { endTime: e.target.value })}
                    />
                  </div>
                  {day.breaks.map((brk, idx) => (
                    <div key={idx} className="flex items-end gap-2">
                      <Input
                        type="time"
                        label="Перерыв с"
                        value={brk.start}
                        onChange={(e) => updateBreak(dow, idx, { start: e.target.value })}
                        className="flex-1"
                      />
                      <Input
                        type="time"
                        label="до"
                        value={brk.end}
                        onChange={(e) => updateBreak(dow, idx, { end: e.target.value })}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-11 min-w-11 shrink-0"
                        aria-label="Удалить перерыв"
                        onClick={() => removeBreak(dow, idx)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => addBreak(dow)}
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Перерыв
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-h3">Особые дни</h2>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => addException(true)}>
              Выходной
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => addException(false)}>
              Другое время
            </Button>
          </div>
        </div>
        {exceptions.length === 0 ? (
          <p className="text-body-sm text-text-secondary">Нет особых дней в периоде.</p>
        ) : (
          <div className="space-y-3">
            {exceptions.map((ex, idx) => (
              <Card key={`${ex.date}-${idx}`} padding="sm" className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <Input
                    type="date"
                    label="Дата"
                    value={ex.date}
                    min={horizon.from}
                    max={horizon.to}
                    onChange={(e) => updateException(idx, { date: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-7 min-h-11 min-w-11"
                    aria-label="Удалить особый день"
                    onClick={() => removeException(idx)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-caption text-text-muted">{formatExceptionDate(ex.date)}</p>
                {ex.off ? (
                  <p className="text-body-sm text-text-secondary">Выходной</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="time"
                      label="С"
                      value={ex.startTime ?? '10:00'}
                      onChange={(e) => updateException(idx, { startTime: e.target.value })}
                    />
                    <Input
                      type="time"
                      label="До"
                      value={ex.endTime ?? '16:00'}
                      onChange={(e) => updateException(idx, { endTime: e.target.value })}
                    />
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      {(saveError || successMessage) && (
        <p
          className={`mt-4 text-body-sm ${saveError ? 'text-danger' : 'text-brand'}`}
          role="status"
        >
          {saveError || successMessage}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-surface/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur md:static md:mt-6 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <Button
          type="button"
          fullWidth
          disabled={!isOnline || saveMutation.isPending}
          onClick={handleSave}
        >
          {saveMutation.isPending ? 'Сохранение…' : 'Сохранить'}
        </Button>
        {!isOnline && (
          <p className="mt-2 text-center text-caption text-danger">{OFFLINE_NETWORK_MESSAGE}</p>
        )}
      </div>
    </div>
  );
}
