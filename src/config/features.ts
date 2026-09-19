/**
 * Feature flags. YCLIENTS lessons: schedule / book / cancel via Partner API (SoT = YC).
 * Requires VITE_API_MODE=pocketbase + server env YCLIENTS_*.
 */
export const YCLIENTS_LESSONS_SOURCE = 'yclients' as const;

export function isYclientsLessonsEnabled(): boolean {
  return import.meta.env.VITE_LESSONS_SOURCE === YCLIENTS_LESSONS_SOURCE;
}
