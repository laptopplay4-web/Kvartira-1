import type { SchoolEvent } from '@/types';
import { normalizeClockTime, parseLessonDateTime } from '@/utils/dates';

/** Epoch ms of event start, or null if date/time invalid. */
export function getEventStartMs(event: Pick<SchoolEvent, 'date' | 'startTime'>): number | null {
  const start = parseLessonDateTime(event.date, normalizeClockTime(event.startTime) || event.startTime);
  const ms = start.getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * End of event: `endTime` on the same date when set, otherwise start.
 * Invalid → null.
 */
export function getEventEndMs(
  event: Pick<SchoolEvent, 'date' | 'startTime' | 'endTime'>,
): number | null {
  const clock = normalizeClockTime(event.endTime) || normalizeClockTime(event.startTime);
  if (!clock) return getEventStartMs(event);
  const end = parseLessonDateTime(event.date, clock);
  const ms = end.getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** Прошедшее по дате+времени окончания (без endTime — по началу). */
export function isEventArchived(
  event: Pick<SchoolEvent, 'date' | 'startTime' | 'endTime'>,
  now = new Date(),
): boolean {
  const endMs = getEventEndMs(event);
  if (endMs == null) return true;
  return endMs < now.getTime();
}

export function filterActiveEvents(events: SchoolEvent[], now = new Date()): SchoolEvent[] {
  return events.filter((event) => !isEventArchived(event, now));
}

export function filterArchivedEvents(events: SchoolEvent[], now = new Date()): SchoolEvent[] {
  return events.filter((event) => isEventArchived(event, now));
}

/** Active list: soonest start first. */
export function sortEventsByStartAsc(events: SchoolEvent[]): SchoolEvent[] {
  return [...events].sort((a, b) => {
    const aMs = getEventStartMs(a) ?? Number.POSITIVE_INFINITY;
    const bMs = getEventStartMs(b) ?? Number.POSITIVE_INFINITY;
    return aMs - bMs;
  });
}

/** Archive list: most recently ended first. */
export function sortArchivedEventsDesc(events: SchoolEvent[]): SchoolEvent[] {
  return [...events].sort((a, b) => {
    const aMs = getEventEndMs(a) ?? 0;
    const bMs = getEventEndMs(b) ?? 0;
    return bMs - aMs;
  });
}

/** Nearest upcoming (not archived) by start time. Does not mutate the input array. */
export function getNextUpcomingEvent(events: SchoolEvent[], now = new Date()): SchoolEvent | undefined {
  const nowMs = now.getTime();
  let nearest: SchoolEvent | undefined;
  let nearestMs = Number.POSITIVE_INFINITY;

  for (const event of events) {
    if (isEventArchived(event, now)) continue;
    const startMs = getEventStartMs(event);
    if (startMs == null || startMs < nowMs) continue;
    if (startMs < nearestMs) {
      nearestMs = startMs;
      nearest = event;
    }
  }

  return nearest;
}
