import type { SchoolEvent } from '@/types';

/** Единый счётчик мест: поле registeredCount или длина roster. */
export function getEventRegisteredCount(
  event: Pick<SchoolEvent, 'registeredCount' | 'registeredUserIds'>,
): number {
  if (typeof event.registeredCount === 'number' && event.registeredCount >= 0) {
    return event.registeredCount;
  }
  return event.registeredUserIds?.length ?? 0;
}

export function isEventRegistrationFull(
  event: Pick<SchoolEvent, 'maxParticipants' | 'registeredCount' | 'registeredUserIds'>,
): boolean {
  if (event.maxParticipants == null) return false;
  return getEventRegisteredCount(event) >= event.maxParticipants;
}

export function isUserRegisteredForEvent(
  event: Pick<SchoolEvent, 'registeredUserIds' | 'isRegistered'>,
  userId: string,
): boolean {
  if (typeof event.isRegistered === 'boolean') return event.isRegistered;
  return event.registeredUserIds.includes(userId);
}

/**
 * Нормализация для ответа API: count + isRegistered;
 * для non-staff roster скрыт (только свой id при наличии).
 */
export function presentSchoolEvent(
  event: SchoolEvent,
  viewerId: string,
  options?: { hideRoster?: boolean },
): SchoolEvent {
  const registeredCount = getEventRegisteredCount(event);
  const isRegistered = isUserRegisteredForEvent(event, viewerId);
  const hideRoster = options?.hideRoster === true;

  const presented: SchoolEvent = {
    ...event,
    registeredCount,
    isRegistered,
    registeredUserIds: hideRoster
      ? isRegistered
        ? [viewerId]
        : []
      : [...event.registeredUserIds],
  };

  return presented;
}

export function syncEventRegistrationFields(event: SchoolEvent): void {
  event.registeredCount = event.registeredUserIds.length;
}
