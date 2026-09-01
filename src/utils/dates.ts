import { format, parseISO, isToday, isTomorrow, isYesterday, addMinutes, isBefore, parse, getDay } from 'date-fns';
import { ru } from 'date-fns/locale';

const TIME_FMT = 'HH:mm';

/** Safe ISO compare for sort — missing dates sort first. */
export function compareIsoDates(a: string | undefined, b: string | undefined): number {
  return (a ?? '').localeCompare(b ?? '');
}

export function parseLessonDateTime(dateStr: string, time: string): Date {
  return parseISO(`${dateStr}T${time}:00`);
}

export function addMinutesToTime(time: string, minutes: number): string {
  const base = parse(time, TIME_FMT, new Date());
  return format(addMinutes(base, minutes), TIME_FMT);
}

export function formatTimeRange(startTime: string, durationMinutes: number): string {
  return `${startTime}–${addMinutesToTime(startTime, durationMinutes)}`;
}

export function isSlotInPast(dateStr: string, startTime: string, now = new Date()): boolean {
  return isBefore(parseLessonDateTime(dateStr, startTime), now);
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
