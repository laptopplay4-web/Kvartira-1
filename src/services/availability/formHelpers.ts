import type {
  DayAvailability,
  SlotInterval,
  TeacherAvailability,
  TimeRange,
  AvailabilityException,
} from '@/types';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from 'date-fns';

export const WEEKDAYS = [
  { dayOfWeek: 1, label: 'Понедельник' },
  { dayOfWeek: 2, label: 'Вторник' },
  { dayOfWeek: 3, label: 'Среда' },
  { dayOfWeek: 4, label: 'Четверг' },
  { dayOfWeek: 5, label: 'Пятница' },
  { dayOfWeek: 6, label: 'Суббота' },
  { dayOfWeek: 0, label: 'Воскресенье' },
] as const;

export interface WorkHoursFormState {
  startTime: string;
  endTime: string;
  breaks: TimeRange[];
}

export interface AvailabilityFormState {
  periodStart: string | null;
  periodEnd: string | null;
  workHours: WorkHoursFormState;
  offDates: string[];
  slotIntervalMinutes: SlotInterval;
}

export type ExceptionFormType = 'off' | 'custom';

export interface ExceptionFormItem {
  id: string;
  startDate: string;
  endDate: string;
  type: ExceptionFormType;
  startTime: string;
  endTime: string;
}

const DEFAULT_WORK_HOURS: WorkHoursFormState = {
  startTime: '10:00',
  endTime: '19:00',
  breaks: [],
};

const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const;

export function defaultPlanningPeriod(reference = new Date()): { startDate: string; endDate: string } {
  return {
    startDate: format(startOfMonth(reference), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(addMonths(reference, 1)), 'yyyy-MM-dd'),
  };
}

export function createDefaultFormState(): AvailabilityFormState {
  const period = defaultPlanningPeriod();
  return {
    periodStart: period.startDate,
    periodEnd: period.endDate,
    workHours: { ...DEFAULT_WORK_HOURS, breaks: [] },
    offDates: [],
    slotIntervalMinutes: 30,
  };
}

function isNextCalendarDay(prevDate: string, nextDate: string): boolean {
  return format(addDays(parseISO(prevDate), 1), 'yyyy-MM-dd') === nextDate;
}

function createExceptionId(): string {
  return `exc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function exceptionsFromApi(exceptions?: AvailabilityException[]): ExceptionFormItem[] {
  if (!exceptions?.length) return [];

  const sorted = [...exceptions].sort((a, b) => a.date.localeCompare(b.date));
  const items: ExceptionFormItem[] = [];
  let i = 0;

  while (i < sorted.length) {
    const current = sorted[i]!;

    if (current.off) {
      let j = i + 1;
      while (
        j < sorted.length &&
        sorted[j]?.off &&
        isNextCalendarDay(sorted[j - 1]!.date, sorted[j]!.date)
      ) {
        j++;
      }
      items.push({
        id: createExceptionId(),
        startDate: current.date,
        endDate: sorted[j - 1]!.date,
        type: 'off',
        startTime: '10:00',
        endTime: '18:00',
      });
      i = j;
      continue;
    }

    const range = current.ranges?.[0];
    if (range) {
      items.push({
        id: createExceptionId(),
        startDate: current.date,
        endDate: current.date,
        type: 'custom',
        startTime: range.start,
        endTime: range.end,
      });
    }
    i++;
  }

  return items;
}

export function exceptionsToApi(items: ExceptionFormItem[]): AvailabilityException[] {
  const result: AvailabilityException[] = [];

  for (const item of items) {
    const dates = eachDayOfInterval({
      start: parseISO(item.startDate),
      end: parseISO(item.endDate),
    });

    for (const date of dates) {
      const dateStr = format(date, 'yyyy-MM-dd');
      if (item.type === 'off') {
        result.push({ date: dateStr, off: true });
      } else {
        result.push({
          date: dateStr,
          ranges: [{ start: item.startTime, end: item.endTime }],
        });
      }
    }
  }

  return result;
}

export function offDatesFromApi(exceptions?: AvailabilityException[]): string[] {
  if (!exceptions?.length) return [];
  return exceptions.filter((e) => e.off).map((e) => e.date).sort();
}

export function customExceptionsFromApi(exceptions?: AvailabilityException[]): ExceptionFormItem[] {
  return exceptionsFromApi(exceptions?.filter((e) => !e.off));
}

export function createDefaultExceptionItem(startDate: string): ExceptionFormItem {
  return {
    id: createExceptionId(),
    startDate,
    endDate: startDate,
    type: 'off',
    startTime: '10:00',
    endTime: '18:00',
  };
}

export function formatExceptionLabel(item: ExceptionFormItem): string {
  if (item.startDate === item.endDate) {
    return item.startDate;
  }
  return `${item.startDate} — ${item.endDate}`;
}

function extractWorkHours(schedule: DayAvailability[]): WorkHoursFormState {
  const first = schedule.find((d) => d.ranges[0]);
  if (!first?.ranges[0]) {
    return { ...DEFAULT_WORK_HOURS, breaks: [] };
  }
  return {
    startTime: first.ranges[0].start,
    endTime: first.ranges[0].end,
    breaks: [...(first.breaks ?? [])],
  };
}

export function availabilityToForm(availability: TeacherAvailability | null): AvailabilityFormState {
  const form = createDefaultFormState();
  if (!availability) return form;

  form.slotIntervalMinutes = availability.slotIntervalMinutes;
  form.workHours = extractWorkHours(availability.schedule);
  form.offDates = offDatesFromApi(availability.exceptions);

  if (availability.planningPeriod) {
    form.periodStart = availability.planningPeriod.startDate;
    form.periodEnd = availability.planningPeriod.endDate;
  }

  return form;
}

export function formToAvailability(
  teacherId: string,
  form: AvailabilityFormState,
  defaultLessonDurationMinutes = 60,
): TeacherAvailability {
  const schedule: DayAvailability[] = ALL_WEEKDAYS.map((dayOfWeek) => ({
    dayOfWeek,
    ranges: [{ start: form.workHours.startTime, end: form.workHours.endTime }],
    breaks: form.workHours.breaks.length > 0 ? form.workHours.breaks : undefined,
  }));

  const exceptions: AvailabilityException[] = form.offDates.map((date) => ({
    date,
    off: true,
  }));

  return {
    teacherId,
    slotIntervalMinutes: form.slotIntervalMinutes,
    defaultLessonDurationMinutes,
    schedule,
    exceptions: exceptions.length > 0 ? exceptions : [],
    planningPeriod:
      form.periodStart && form.periodEnd
        ? { startDate: form.periodStart, endDate: form.periodEnd }
        : undefined,
  };
}

export function getWeekdayLabel(dayOfWeek: number): string {
  return WEEKDAYS.find((d) => d.dayOfWeek === dayOfWeek)?.label ?? '';
}

export function isDateInPeriod(date: string, start: string | null, end: string | null): boolean {
  if (!start || !end) return false;
  return date >= start && date <= end;
}

export function normalizePeriodRange(start: string, end: string): { start: string; end: string } {
  if (end < start) {
    return { start: end, end: start };
  }
  return { start, end };
}

export function toggleOffDate(offDates: string[], date: string): string[] {
  if (offDates.includes(date)) {
    return offDates.filter((d) => d !== date);
  }
  return [...offDates, date].sort();
}
