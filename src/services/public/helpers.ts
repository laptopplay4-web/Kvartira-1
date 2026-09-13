import type {
  Direction,
  PublicEvent,
  PublicTeacher,
  SchoolEvent,
  User,
} from '@/types';
import { isSlotInPast } from '@/utils/dates';

export function toPublicTeacher(
  user: User,
  directionIds: string[],
  directions: Direction[],
): PublicTeacher {
  const teacherDirections = directions.filter((d) => directionIds.includes(d.id));
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    directions: teacherDirections.map(({ id, name, icon }) => ({ id, name, icon })),
  };
}

export function toPublicEvent(event: SchoolEvent, now = new Date()): PublicEvent | null {
  if (event.type === 'invited') return null;
  if (isSlotInPast(event.date, event.startTime, now)) return null;

  const taken =
    typeof event.registeredCount === 'number'
      ? event.registeredCount
      : event.registeredUserIds.length;
  const spotsLeft =
    event.maxParticipants != null ? Math.max(0, event.maxParticipants - taken) : undefined;

  return {
    id: event.id,
    title: event.title,
    description: event.description,
    type: event.type,
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    location: event.location,
    imageUrl: event.imageUrl,
    maxParticipants: event.maxParticipants,
    spotsLeft,
  };
}

export function filterPublicEvents(events: SchoolEvent[], now = new Date()): PublicEvent[] {
  return events
    .map((event) => toPublicEvent(event, now))
    .filter((event): event is PublicEvent => event != null)
    .sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      return cmp !== 0 ? cmp : a.startTime.localeCompare(b.startTime);
    });
}
