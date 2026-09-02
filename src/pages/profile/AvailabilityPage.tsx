import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addMonths, format, subMonths } from 'date-fns';
import { Clock, Plus, Settings2, Trash2 } from 'lucide-react';
import { BackLink } from '@/components/ui/BackLink';
import { useCurrentUser } from '@/stores/authStore';
import { can } from '@/permissions';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import {
  availabilityToForm,
  createDefaultFormState,
  formToAvailability,
  isDateInPeriod,
  normalizePeriodRange,
  toggleOffDate,
  type AvailabilityFormState,
  type WorkHoursFormState,
} from '@/services/availability/formHelpers';
import {
  validateAvailabilityForm,
  type AvailabilityValidationError,
} from '@/services/availability/validateAvailability';
import { AvailabilityMonthCalendar } from '@/components/availability/AvailabilityMonthCalendar';
import type { AvailabilityCalendarMode } from '@/components/availability/AvailabilityMonthCalendar';
import { AvailabilityIntervalModal } from '@/components/availability/AvailabilityIntervalModal';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import type { SlotInterval } from '@/types';

const INTERVAL_LABELS: Record<number, string> = {
  15: '15 минут',
  30: '30 минут',
  40: '40 минут',
  60: '60 минут',
};

function getFieldError(
  errors: AvailabilityValidationError[],
  field: AvailabilityValidationError['field'],
): string | undefined {
  return errors.find((e) => e.field === field)?.message;
}

function todayInputValue() {
  return format(new Date(), 'yyyy-MM-dd');
}

export default function AvailabilityPage() {
  const user = useCurrentUser()!;
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AvailabilityFormState>(() => createDefaultFormState());
  const [validationErrors, setValidationErrors] = useState<AvailabilityValidationError[]>([]);
  const [saveError, setSaveError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [calendarAnchor, setCalendarAnchor] = useState(() => new Date());
  const [calendarMode, setCalendarMode] = useState<AvailabilityCalendarMode>('period');
  const [pendingPeriodStart, setPendingPeriodStart] = useState<string | null>(null);
  const [intervalModalOpen, setIntervalModalOpen] = useState(false);

  const canManage = can(user, 'availability:manage');
  const teacherId = user.id;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['availability', teacherId],
    queryFn: () => api.availability.getTeacherAvailability(teacherId, user.id),
    enabled: canManage,
  });

  useEffect(() => {
    if (data !== undefined) {
      setForm(availabilityToForm(data));
      if (data?.planningPeriod?.startDate) {
        setCalendarAnchor(new Date(data.planningPeriod.startDate));
      }
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = formToAvailability(
        teacherId,
        form,
        data?.defaultLessonDurationMinutes ?? 60,
      );
      return api.availability.updateTeacherAvailability(
        teacherId,
        {
          slotIntervalMinutes: payload.slotIntervalMinutes,
          schedule: payload.schedule,
          defaultLessonDurationMinutes: payload.defaultLessonDurationMinutes,
          exceptions: payload.exceptions,
          planningPeriod: payload.planningPeriod,
        },
        user.id,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability', teacherId] });
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      setSaveError('');
      setValidationErrors([]);
      setSuccessMessage('Настройки сохранены');
      setTimeout(() => setSuccessMessage(''), 4000);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'VALIDATION_ERROR') {
        setSaveError('');
        return;
      }
      setSaveError('Не удалось сохранить настройки. Попробуйте ещё раз.');
    },
  });

  const clearErrors = () => {
    setValidationErrors([]);
    setSaveError('');
  };

  const updateWorkHours = (patch: Partial<WorkHoursFormState>) => {
    setForm((prev) => ({
      ...prev,
      workHours: { ...prev.workHours, ...patch },
    }));
    clearErrors();
  };

  const updatePeriod = (start: string | null, end: string | null) => {
    setForm((prev) => ({
      ...prev,
      periodStart: start,
      periodEnd: end,
      offDates: prev.offDates.filter((d) => (start && end ? d >= start && d <= end : false)),
    }));
    clearErrors();
  };

  const addBreak = () => {
    updateWorkHours({
      breaks: [...form.workHours.breaks, { start: '13:00', end: '14:00' }],
    });
  };

  const updateBreak = (index: number, field: 'start' | 'end', value: string) => {
    const breaks = form.workHours.breaks.map((b, i) =>
      i === index ? { ...b, [field]: value } : b,
    );
    updateWorkHours({ breaks });
  };

  const removeBreak = (index: number) => {
    updateWorkHours({ breaks: form.workHours.breaks.filter((_, i) => i !== index) });
  };

  const handleCalendarDayClick = (date: string) => {
    if (calendarMode === 'period') {
      if (!pendingPeriodStart) {
        setPendingPeriodStart(date);
        updatePeriod(date, date);
        return;
      }

      const { start, end } = normalizePeriodRange(pendingPeriodStart, date);
      updatePeriod(start, end);
      setPendingPeriodStart(null);
      setCalendarMode('off-days');
      return;
    }

    if (!isDateInPeriod(date, form.periodStart, form.periodEnd)) return;

    setForm((prev) => ({
      ...prev,
      offDates: toggleOffDate(prev.offDates, date),
    }));
    clearErrors();
  };

  const handlePeriodInputChange = (field: 'start' | 'end', value: string) => {
    const start = field === 'start' ? value : form.periodStart;
    const end = field === 'end' ? value : form.periodEnd;
    if (start && end) {
      const normalized = normalizePeriodRange(start, end);
      updatePeriod(normalized.start, normalized.end);
    } else {
      updatePeriod(start, end);
    }
    setPendingPeriodStart(null);
  };

  const startPeriodSelection = () => {
    setCalendarMode('period');
    setPendingPeriodStart(null);
  };

  const handleSave = () => {
    if (!isOnline) return;
    const errors = validateAvailabilityForm(form);
    setValidationErrors(errors);
    if (errors.length > 0) return;
    setSaveError('');
    saveMutation.mutate();
  };

  const hasConfiguredSchedule = data !== null && (data?.schedule.length ?? 0) > 0;
  const periodReady = Boolean(form.periodStart && form.periodEnd);
  const showEmptyHint = !isLoading && !hasConfiguredSchedule && !periodReady;

  const endTimeError = getFieldError(validationErrors, 'endTime');
  const breaksError = getFieldError(validationErrors, 'breaks');
  const scheduleError = getFieldError(validationErrors, 'schedule');
  const intervalError = getFieldError(validationErrors, 'slotIntervalMinutes');

  return (
    <div className="page-container max-w-lg">
      <BackLink label="Занятия" fallbackTo="/lessons" />

      <header className="mb-6">
        <h1 className="text-h1">График работы</h1>
        <p className="mt-2 text-body-sm text-text-secondary">
          Выберите период приёма занятий, укажите время работы и отметьте выходные в календаре.
        </p>
      </header>

      {successMessage && (
        <div
          className="mb-4 rounded-lg bg-success-muted px-4 py-3 text-sm text-success"
          role="status"
          aria-live="polite"
        >
          {successMessage}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState message="Не удалось загрузить график работы" onRetry={() => refetch()} />
      ) : (
        <>
          {showEmptyHint && (
            <Card className="mb-6 border-brand/30 bg-brand-muted/20">
              <p className="text-h3">Настройте график</p>
              <p className="mt-1 text-body-sm text-text-secondary">
                Сначала выберите период в календаре, затем укажите рабочее время.
              </p>
            </Card>
          )}

          <Card className="mb-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-h3">Период занятий</h2>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={calendarMode === 'period' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={startPeriodSelection}
                >
                  Выбрать период
                </Button>
                <Button
                  type="button"
                  variant={calendarMode === 'off-days' ? 'primary' : 'secondary'}
                  size="sm"
                  disabled={!periodReady}
                  onClick={() => {
                    setCalendarMode('off-days');
                    setPendingPeriodStart(null);
                  }}
                >
                  Выходные
                </Button>
              </div>
            </div>

            <p className="text-body-sm text-text-secondary">
              {calendarMode === 'period'
                ? 'Нажмите начало и конец периода в календаре или укажите даты ниже.'
                : 'Нажмите день в периоде, чтобы отметить или снять выходной.'}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="С даты"
                type="date"
                value={form.periodStart ?? ''}
                min={todayInputValue()}
                onChange={(e) => handlePeriodInputChange('start', e.target.value)}
              />
              <Input
                label="По дату"
                type="date"
                value={form.periodEnd ?? ''}
                min={form.periodStart ?? todayInputValue()}
                onChange={(e) => handlePeriodInputChange('end', e.target.value)}
              />
            </div>

            <AvailabilityMonthCalendar
              anchor={calendarAnchor}
              onPrevMonth={() => setCalendarAnchor((d) => subMonths(d, 1))}
              onNextMonth={() => setCalendarAnchor((d) => addMonths(d, 1))}
              onToday={() => setCalendarAnchor(new Date())}
              periodStart={form.periodStart}
              periodEnd={form.periodEnd}
              offDates={form.offDates}
              mode={calendarMode}
              pendingPeriodStart={pendingPeriodStart}
              onDayClick={handleCalendarDayClick}
            />
          </Card>

          {periodReady && (
            <Card className="mb-6 space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-brand" aria-hidden />
                <h2 className="text-h3">Рабочее время</h2>
              </div>
              <p className="text-body-sm text-text-secondary">
                Одно время для всех дней периода. Выходные отмечаются в календаре.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Начало"
                  type="time"
                  value={form.workHours.startTime}
                  onChange={(e) => updateWorkHours({ startTime: e.target.value })}
                  error={endTimeError}
                />
                <Input
                  label="Окончание"
                  type="time"
                  value={form.workHours.endTime}
                  onChange={(e) => updateWorkHours({ endTime: e.target.value })}
                  error={endTimeError}
                />
              </div>

              <div>
                <p className="mb-2 text-label">Перерывы</p>
                {form.workHours.breaks.length === 0 ? (
                  <p className="text-caption text-text-muted">Нет перерывов</p>
                ) : (
                  <ul className="space-y-2">
                    {form.workHours.breaks.map((brk, index) => (
                      <li key={index} className="flex items-end gap-2">
                        <Input
                          label={index === 0 ? 'С' : undefined}
                          type="time"
                          value={brk.start}
                          onChange={(e) => updateBreak(index, 'start', e.target.value)}
                          className="flex-1"
                          aria-label={`Начало перерыва ${index + 1}`}
                        />
                        <span className="pb-3 text-text-muted" aria-hidden>
                          —
                        </span>
                        <Input
                          label={index === 0 ? 'До' : undefined}
                          type="time"
                          value={brk.end}
                          onChange={(e) => updateBreak(index, 'end', e.target.value)}
                          className="flex-1"
                          aria-label={`Окончание перерыва ${index + 1}`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeBreak(index)}
                          aria-label={`Удалить перерыв ${brk.start} — ${brk.end}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                {breaksError && (
                  <p className="mt-1 text-caption text-danger" role="alert">
                    {breaksError}
                  </p>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-2"
                  onClick={addBreak}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Добавить перерыв
                </Button>
              </div>
            </Card>
          )}

          <Button
            type="button"
            variant="secondary"
            fullWidth
            className="mb-6"
            onClick={() => setIntervalModalOpen(true)}
          >
            <Settings2 className="h-4 w-4" aria-hidden />
            Интервал между занятиями · {INTERVAL_LABELS[form.slotIntervalMinutes]}
          </Button>

          <AvailabilityIntervalModal
            open={intervalModalOpen}
            onClose={() => setIntervalModalOpen(false)}
            value={form.slotIntervalMinutes}
            onChange={(interval: SlotInterval) => {
              setForm((prev) => ({ ...prev, slotIntervalMinutes: interval }));
              clearErrors();
            }}
            error={intervalError}
          />

          {scheduleError && (
            <p className="mb-4 text-sm text-danger" role="alert">
              {scheduleError}
            </p>
          )}

          {saveError && (
            <div className="mb-4 space-y-3" role="alert">
              <p className="text-sm text-danger">{saveError}</p>
              <Button variant="secondary" size="sm" disabled={!isOnline} onClick={handleSave}>
                Повторить
              </Button>
            </div>
          )}

          {!isOnline && (
            <p
              className="mb-4 rounded-lg bg-danger-muted px-4 py-3 text-sm text-danger"
              role="alert"
            >
              {OFFLINE_NETWORK_MESSAGE}
            </p>
          )}

          <Button
            fullWidth
            loading={saveMutation.isPending}
            disabled={saveMutation.isPending || !isOnline || !periodReady}
            onClick={handleSave}
          >
            {saveMutation.isPending ? 'Сохраняем...' : 'Сохранить изменения'}
          </Button>
        </>
      )}
    </div>
  );
}
