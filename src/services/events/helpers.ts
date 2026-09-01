import type { SchoolEvent } from '@/types';
import { isSlotInPast } from '@/utils/dates';

/** Nearest upcoming event by date + startTime. Does not mutate the input array. */
export function getNextUpcomingEvent(events: SchoolEvent[], now = new Date()): SchoolEvent | undefined {
  return events
    .filter((event) => !isSlotInPast(event.date, event.startTime, now))
    .sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      return cmp !== 0 ? cmp : a.startTime.localeCompare(b.startTime);
    })[0];
}
