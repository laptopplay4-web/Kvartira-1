import { addDays, addWeeks, eachDayOfInterval, format, getDay, parseISO } from 'date-fns';
import type { TimeRange } from '@/types';
import type {
  YclientsScheduleDayDto,
  YclientsScheduleException,
  YclientsScheduleSlot,
  YclientsScheduleWritePayload,
  YclientsWeekDayTemplate,
} from '@/services/yclients/types';

/** Horizon applied when expanding week template → concrete YC dates. */
export const YCLIENTS_SCHEDULE_HORIZON_WEEKS = 8;

export const YCLIENTS_WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export const YCLIENTS_WEEKDAY_LABELS: Record<number, string> = {
  0: 'Воскресенье',
  1: 'Понедельник',
  2: 'Вторник',
  3: 'Среда',
  4: 'Четверг',
  5: 'Пятница',
  6: 'Суббота',
};

function timeToMinutes(t: string): number {
  const m = String(t || '').match(/^(\d{2}):(\d{2})$/);
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

function sortSlots(slots: YclientsScheduleSlot[]): YclientsScheduleSlot[] {
  return [...slots].sort((a, b) => timeToMinutes(a.from) - timeToMinutes(b.from));
}

function slotsFingerprint(slots: YclientsScheduleSlot[]): string {
  if (!slots.length) return 'off';
  return sortSlots(slots)
    .map((s) => `${s.from}-${s.to}`)
    .join('|');
}

/** YC slots → single work window + breaks (gaps between consecutive slots). */
export function slotsToWorkAndBreaks(slots: YclientsScheduleSlot[]): {
  startTime: string;
  endTime: string;
  breaks: TimeRange[];
} | null {
  const sorted = sortSlots(slots).filter(
    (s) => Number.isFinite(timeToMinutes(s.from)) && Number.isFinite(timeToMinutes(s.to)),
  );
  if (!sorted.length) return null;
  const startTime = sorted[0]!.from;
  const endTime = sorted[sorted.length - 1]!.to;
  const breaks: TimeRange[] = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const cur = sorted[i]!;
    const next = sorted[i + 1]!;
    if (timeToMinutes(cur.to) < timeToMinutes(next.from)) {
      breaks.push({ start: cur.to, end: next.from });
    }
  }
  return { startTime, endTime, breaks };
}

/** Work window + breaks → YC slots (gaps become separate working segments). */
export function workAndBreaksToSlots(
  startTime: string,
  endTime: string,
  breaks: TimeRange[] = [],
): YclientsScheduleSlot[] {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return [];

  const sortedBreaks = [...breaks]
    .filter((b) => {
      const bs = timeToMinutes(b.start);
      const be = timeToMinutes(b.end);
      return Number.isFinite(bs) && Number.isFinite(be) && bs < be && bs >= start && be <= end;
    })
    .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

  const slots: YclientsScheduleSlot[] = [];
  let cursor = startTime;
  for (const br of sortedBreaks) {
    if (timeToMinutes(cursor) < timeToMinutes(br.start)) {
      slots.push({ from: cursor, to: br.start });
    }
    cursor = br.end;
  }
  if (timeToMinutes(cursor) < end) {
    slots.push({ from: cursor, to: endTime });
  }
  return slots;
}

export function createEmptyWeekTemplate(): YclientsWeekDayTemplate[] {
  return YCLIENTS_WEEKDAY_ORDER.map((dayOfWeek) => ({
    dayOfWeek,
    enabled: dayOfWeek >= 1 && dayOfWeek <= 5,
    startTime: '10:00',
    endTime: '19:00',
    breaks: [],
  }));
}

/** Infer Пн–Вс template from concrete YC schedule days (mode per weekday). */
export function inferWeekTemplateFromDates(
  days: YclientsScheduleDayDto[],
): YclientsWeekDayTemplate[] {
  const byWeekday = new Map<number, Map<string, number>>();
  for (const day of days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date)) continue;
    const dow = getDay(parseISO(day.date));
    const fp =
      day.isWorking && day.slots.length > 0 ? slotsFingerprint(day.slots) : 'off';
    let counts = byWeekday.get(dow);
    if (!counts) {
      counts = new Map();
      byWeekday.set(dow, counts);
    }
    counts.set(fp, (counts.get(fp) ?? 0) + 1);
  }

  return YCLIENTS_WEEKDAY_ORDER.map((dayOfWeek) => {
    const counts = byWeekday.get(dayOfWeek);
    let bestFp = 'off';
    let bestN = 0;
    if (counts) {
      for (const [fp, n] of counts) {
        if (n > bestN) {
          bestN = n;
          bestFp = fp;
        }
      }
    }
    if (bestFp === 'off' || bestN === 0) {
      return {
        dayOfWeek,
        enabled: false,
        startTime: '10:00',
        endTime: '19:00',
        breaks: [],
      };
    }
    const slots = bestFp.split('|').map((part) => {
      const [from, to] = part.split('-');
      return { from: from!, to: to! };
    });
    const work = slotsToWorkAndBreaks(slots);
    return {
      dayOfWeek,
      enabled: true,
      startTime: work?.startTime ?? '10:00',
      endTime: work?.endTime ?? '19:00',
      breaks: work?.breaks ?? [],
    };
  });
}

/**
 * Dates that differ from the inferred week template (off when template on, or custom hours).
 */
export function inferExceptionsFromDates(
  days: YclientsScheduleDayDto[],
  template: YclientsWeekDayTemplate[],
): YclientsScheduleException[] {
  const tplByDow = new Map(template.map((t) => [t.dayOfWeek, t]));
  const exceptions: YclientsScheduleException[] = [];

  for (const day of days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date)) continue;
    const dow = getDay(parseISO(day.date));
    const tpl = tplByDow.get(dow);
    if (!tpl) continue;

    const dayWorking = day.isWorking && day.slots.length > 0;
    if (!tpl.enabled) {
      if (dayWorking) {
        const work = slotsToWorkAndBreaks(day.slots);
        if (work) {
          exceptions.push({
            date: day.date,
            off: false,
            startTime: work.startTime,
            endTime: work.endTime,
            breaks: work.breaks,
          });
        }
      }
      continue;
    }

    const tplSlots = workAndBreaksToSlots(tpl.startTime, tpl.endTime, tpl.breaks);
    const tplFp = slotsFingerprint(tplSlots);
    const dayFp = dayWorking ? slotsFingerprint(day.slots) : 'off';
    if (dayFp === tplFp) continue;

    if (!dayWorking) {
      exceptions.push({ date: day.date, off: true });
    } else {
      const work = slotsToWorkAndBreaks(day.slots);
      if (work) {
        exceptions.push({
          date: day.date,
          off: false,
          startTime: work.startTime,
          endTime: work.endTime,
          breaks: work.breaks,
        });
      }
    }
  }

  return exceptions.sort((a, b) => a.date.localeCompare(b.date));
}

export function scheduleHorizonRange(reference = new Date()): { from: string; to: string } {
  const from = format(reference, 'yyyy-MM-dd');
  const to = format(addWeeks(parseISO(from), YCLIENTS_SCHEDULE_HORIZON_WEEKS), 'yyyy-MM-dd');
  return { from, to };
}

function slotsForTemplateDay(day: YclientsWeekDayTemplate): YclientsScheduleSlot[] {
  if (!day.enabled) return [];
  return workAndBreaksToSlots(day.startTime, day.endTime, day.breaks);
}

function slotsForException(ex: YclientsScheduleException): YclientsScheduleSlot[] | null {
  if (ex.off) return null;
  if (!ex.startTime || !ex.endTime) return null;
  return workAndBreaksToSlots(ex.startTime, ex.endTime, ex.breaks ?? []);
}

/**
 * Expand week template + exceptions into YC write payload for [from, to].
 * Off days → schedulesToDelete; working → schedulesToSet (grouped by identical slots).
 */
export function expandWeekTemplateToDates(
  staffId: number,
  template: YclientsWeekDayTemplate[],
  exceptions: YclientsScheduleException[],
  from: string,
  to: string,
): YclientsScheduleWritePayload {
  const tplByDow = new Map(template.map((t) => [t.dayOfWeek, t]));
  const exByDate = new Map(exceptions.map((e) => [e.date, e]));
  const setGroups = new Map<string, { dates: string[]; slots: YclientsScheduleSlot[] }>();
  const deleteDates: string[] = [];

  const interval = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) });
  for (const d of interval) {
    const date = format(d, 'yyyy-MM-dd');
    const ex = exByDate.get(date);
    let slots: YclientsScheduleSlot[] | null;

    if (ex) {
      slots = slotsForException(ex);
    } else {
      const tpl = tplByDow.get(getDay(d));
      if (!tpl?.enabled) {
        slots = null;
      } else {
        const daySlots = slotsForTemplateDay(tpl);
        slots = daySlots.length ? daySlots : null;
      }
    }

    if (slots === null || slots.length === 0) {
      deleteDates.push(date);
    } else {
      const fp = slotsFingerprint(slots);
      const group = setGroups.get(fp);
      if (group) group.dates.push(date);
      else setGroups.set(fp, { dates: [date], slots });
    }
  }

  return {
    schedulesToSet: [...setGroups.values()].map((g) => ({
      staffId,
      dates: g.dates,
      slots: g.slots,
    })),
    schedulesToDelete: deleteDates.length
      ? [{ staffId, dates: deleteDates }]
      : [],
  };
}

/** Next calendar date after `from` (inclusive) matching weekday, or null. */
export function nextDateForWeekday(from: string, dayOfWeek: number): string {
  let d = parseISO(from);
  for (let i = 0; i < 7; i += 1) {
    if (getDay(d) === dayOfWeek) return format(d, 'yyyy-MM-dd');
    d = addDays(d, 1);
  }
  return from;
}
