import { format, parseISO, isToday, isTomorrow, isYesterday, addMinutes, isBefore, parse, getDay } from 'date-fns';
import { ru } from 'date-fns/locale';

const TIME_FMT = 'HH:mm';

/** Safe ISO compare for sort — missing dates sort first. */
export function compareIsoDates(a: string | undefined, b: string | undefined): number {
  return (a ?? '').localeCompare(b ?? '');
}

/** Keep `YYYY-MM-DD` from PB/YC date or datetime strings. */
export function normalizeLessonDate(value: string | undefined | null): string {
  if (!value) return '';
  const trimmed = value.trim();
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
  return match?.[1] ?? '';
}

/** Normalize `HH:mm` / `H:mm` / `HH:mm:ss` → `HH:mm`. Empty if unparseable. */
export function normalizeClockTime(value: string | undefined | null): string {
  if (!value) return '';
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return '';
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return '';
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return '';
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function parseLessonDateTime(dateStr: string, time: string): Date {
  const date = dateStr.trim().slice(0, 10);
  const clock = normalizeClockTime(time);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !clock) {
    return new Date(Number.NaN);
  }
  return parseISO(`${date}T${clock}:00`);
}

export function addMinutesToTime(time: string, minutes: number): string {
  const base = parse(normalizeClockTime(time) || time, TIME_FMT, new Date());
  return format(addMinutes(base, minutes), TIME_FMT);
}

export function formatTimeRange(startTime: string, durationMinutes: number): string {
  return `${normalizeClockTime(startTime) || startTime}–${addMinutesToTime(startTime, durationMinutes)}`;
}

export function isSlotInPast(dateStr: string, startTime: string, now = new Date()): boolean {
  const slot = parseLessonDateTime(dateStr, startTime);
  if (Number.isNaN(slot.getTime())) return true;
  return isBefore(slot, now);
}

export function formatLessonDate(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Сегодня';
  if (isTomorrow(date)) return 'Завтра';
  if (isYesterday(date)) return 'Вчера';
  return format(date, 'd MMMM', { locale: ru });
}

export function formatLessonDateTime(dateStr: string, time: string): string {
  return `${formatLessonDate(dateStr)}, ${time}`;
}

export function formatFullDate(dateStr: string | undefined): string {
  if (!dateStr?.trim()) return '—';
  return format(parseISO(dateStr.slice(0, 10)), 'd MMMM yyyy', { locale: ru });
}

export function formatWeekday(dateStr: string): string {
  return format(parseISO(dateStr), 'EEEE', { locale: ru });
}

/** 0 = Sunday … 6 = Saturday (matches TeacherAvailability.schedule in seed) */
export function getDayOfWeekFromDate(dateStr: string): number {
  return getDay(parseISO(dateStr));
}

export function formatChatListTime(isoDate: string | undefined): string {
  if (!isoDate?.trim()) return '';
  const date = parseISO(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  if (isToday(date)) return format(date, TIME_FMT);
  if (isYesterday(date)) return 'Вчера';
  return format(date, 'd MMM', { locale: ru });
}

export function formatChatMessageTime(isoDate: string | undefined): string {
  if (!isoDate?.trim()) return '';
  const date = parseISO(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return format(date, TIME_FMT);
}

export function formatChatDateSeparator(isoDate: string | undefined): string {
  if (!isoDate?.trim()) return '';
  const date = parseISO(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  if (isToday(date)) return 'Сегодня';
  if (isYesterday(date)) return 'Вчера';
  return format(date, 'd MMMM', { locale: ru });
}
