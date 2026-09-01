import { parse, isBefore, startOfDay, format, eachDayOfInterval, parseISO } from 'date-fns';
import type { AvailabilityException, DayAvailability, SlotInterval, TimeRange } from '@/types';
import type { ExceptionFormItem } from '@/services/availability/formHelpers';
import { exceptionsToApi } from '@/services/availability/formHelpers';
import type { AvailabilityFormState } from '@/services/availability/formHelpers';

const TIME_FMT = 'HH:mm';

export const SLOT_INTERVAL_OPTIONS: SlotInterval[] = [15, 30, 40, 60];

export const VALIDATION_MESSAGES = {
  endBeforeStart: 'Время окончания должно быть позже времени начала.',
  breakOutsideWork: 'Перерыв должен быть внутри рабочего времени.',
  breaksOverlap: 'Перерывы не должны пересекаться.',
  invalidInterval: 'Недопустимый интервал записи.',
  noEnabledDays: 'Выберите хотя бы один рабочий день.',
  periodRequired: 'Укажите период, в котором принимаете занятия.',
  periodEndBeforeStart: 'Дата окончания периода не может быть раньше даты начала.',
  periodPastDate: 'Период можно задавать только на сегодня и будущие даты.',
  exceptionEndBeforeStart: 'Дата окончания не может быть раньше даты начала.',
  exceptionPastDate: 'Исключения можно задавать только на сегодня и будущие даты.',
  exceptionDuplicateDate: 'На одну дату нельзя задать несколько исключений.',
  exceptionCustomHours: 'Укажите корректное особое рабочее время.',
} as const;

function parseTime(time: string): Date {
  return parse(time, TIME_FMT, new Date());
}

export function isValidTimeRange(start: string, end: string): boolean {
  return isBefore(parseTime(start), parseTime(end));
}

function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  const aStart = parseTime(a.start);
  const aEnd = parseTime(a.end);
  const bStart = parseTime(b.start);
  const bEnd = parseTime(b.end);
  return isBefore(aStart, bEnd) && isBefore(bStart, aEnd);
}

export function isBreakWithinWorkPeriod(
  brk: TimeRange,
  workStart: string,
  workEnd: string,
): boolean {
  if (!isValidTimeRange(brk.start, brk.end)) return false;
  const bStart = parseTime(brk.start);
  const bEnd = parseTime(brk.end);
  const wStart = parseTime(workStart);
  const wEnd = parseTime(workEnd);
  return !isBefore(bStart, wStart) && !isBefore(wEnd, bEnd);
}

export function hasOverlappingBreaks(breaks: TimeRange[]): boolean {
  for (let i = 0; i < breaks.length; i++) {
    for (let j = i + 1; j < breaks.length; j++) {
      if (rangesOverlap(breaks[i]!, breaks[j]!)) return true;
    }
  }
  return false;
}

export interface AvailabilityValidationError {
  dayOfWeek?: number;
  exceptionId?: string;
  field?:
    | 'startTime'
    | 'endTime'
    | 'breaks'
    | 'slotIntervalMinutes'
    | 'schedule'
    | 'exceptionDate'
    | 'exceptions';
  message: string;
}

export function validateAvailabilityForm(
  form: AvailabilityFormState,
  today = format(startOfDay(new Date()), 'yyyy-MM-dd'),
): AvailabilityValidationError[] {
  const errors: AvailabilityValidationError[] = [];

  if (!form.periodStart || !form.periodEnd) {
    errors.push({
      field: 'schedule',
      message: VALIDATION_MESSAGES.periodRequired,
    });
    return errors;
  }

  if (form.periodEnd < form.periodStart) {
    errors.push({
      field: 'schedule',
      message: VALIDATION_MESSAGES.periodEndBeforeStart,
    });
  }

  if (form.periodStart < today) {
    errors.push({
      field: 'schedule',
      message: VALIDATION_MESSAGES.periodPastDate,
    });
  }

  if (!isValidTimeRange(form.workHours.startTime, form.workHours.endTime)) {
    errors.push({
      field: 'endTime',
      message: VALIDATION_MESSAGES.endBeforeStart,
    });
  } else {
    for (const brk of form.workHours.breaks) {
      if (!isBreakWithinWorkPeriod(brk, form.workHours.startTime, form.workHours.endTime)) {
        errors.push({
          field: 'breaks',
          message: VALIDATION_MESSAGES.breakOutsideWork,
        });
        break;
      }
    }
    if (hasOverlappingBreaks(form.workHours.breaks)) {
      errors.push({
        field: 'breaks',
        message: VALIDATION_MESSAGES.breaksOverlap,
      });
    }
  }

  if (!SLOT_INTERVAL_OPTIONS.includes(form.slotIntervalMinutes)) {
    errors.push({
      field: 'slotIntervalMinutes',
      message: VALIDATION_MESSAGES.invalidInterval,
    });
  }

  return errors;
}

export function validateAvailabilityExceptions(
  items: ExceptionFormItem[],
  today = format(startOfDay(new Date()), 'yyyy-MM-dd'),
): AvailabilityValidationError[] {
  const errors: AvailabilityValidationError[] = [];

  for (const item of items) {
    if (item.endDate < item.startDate) {
      errors.push({
        exceptionId: item.id,
        field: 'exceptionDate',
        message: VALIDATION_MESSAGES.exceptionEndBeforeStart,
      });
      continue;
    }

    const dates = eachDayOfInterval({
      start: parseISO(item.startDate),
      end: parseISO(item.endDate),
    });

    for (const date of dates) {
      const dateStr = format(date, 'yyyy-MM-dd');
      if (dateStr < today) {
        errors.push({
          exceptionId: item.id,
          field: 'exceptionDate',
          message: VALIDATION_MESSAGES.exceptionPastDate,
        });
        break;
      }
    }

    if (item.type === 'custom' && !isValidTimeRange(item.startTime, item.endTime)) {
      errors.push({
        exceptionId: item.id,
        field: 'startTime',
        message: VALIDATION_MESSAGES.exceptionCustomHours,
      });
    }
  }

  const expanded = exceptionsToApi(items);
  const seen = new Set<string>();
  for (const exc of expanded) {
    if (seen.has(exc.date)) {
      errors.push({
        field: 'exceptions',
        message: VALIDATION_MESSAGES.exceptionDuplicateDate,
      });
      break;
    }
    seen.add(exc.date);
  }

  return errors;
}

export function validateDayAvailability(day: DayAvailability): AvailabilityValidationError[] {
  const errors: AvailabilityValidationError[] = [];
  const range = day.ranges[0];
  if (!range) return errors;

  if (!isValidTimeRange(range.start, range.end)) {
    errors.push({
      dayOfWeek: day.dayOfWeek,
      field: 'endTime',
      message: VALIDATION_MESSAGES.endBeforeStart,
    });
    return errors;
  }

  const breaks = day.breaks ?? [];
  for (const brk of breaks) {
    if (!isBreakWithinWorkPeriod(brk, range.start, range.end)) {
      errors.push({
        dayOfWeek: day.dayOfWeek,
        field: 'breaks',
        message: VALIDATION_MESSAGES.breakOutsideWork,
      });
      break;
    }
  }

  if (hasOverlappingBreaks(breaks)) {
    errors.push({
      dayOfWeek: day.dayOfWeek,
      field: 'breaks',
      message: VALIDATION_MESSAGES.breaksOverlap,
    });
  }

  return errors;
}

export function validateTeacherAvailability(data: {
  schedule: DayAvailability[];
  slotIntervalMinutes: SlotInterval;
  exceptions?: AvailabilityException[];
}): AvailabilityValidationError[] {
  const errors: AvailabilityValidationError[] = [];

  if (!SLOT_INTERVAL_OPTIONS.includes(data.slotIntervalMinutes)) {
    errors.push({
      field: 'slotIntervalMinutes',
      message: VALIDATION_MESSAGES.invalidInterval,
    });
  }

  if (data.schedule.length === 0) {
    errors.push({
      field: 'schedule',
      message: VALIDATION_MESSAGES.noEnabledDays,
    });
  }

  for (const day of data.schedule) {
    errors.push(...validateDayAvailability(day));
  }

  return errors;
}
