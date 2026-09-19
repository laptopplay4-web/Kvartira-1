const RECORD_PREFIX = 'yc:';
const STAFF_PREFIX = 'yc-staff:';

export function toYclientsLessonId(recordId: number): string {
  return `${RECORD_PREFIX}${recordId}`;
}

export function parseYclientsLessonId(id: string): number | null {
  if (!id.startsWith(RECORD_PREFIX)) return null;
  const n = Number(id.slice(RECORD_PREFIX.length));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function isYclientsLessonId(id: string): boolean {
  return parseYclientsLessonId(id) !== null;
}

export function toYclientsStaffUserId(staffId: number): string {
  return `${STAFF_PREFIX}${staffId}`;
}

export function parseYclientsStaffUserId(id: string): number | null {
  if (!id.startsWith(STAFF_PREFIX)) return null;
  const n = Number(id.slice(STAFF_PREFIX.length));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function resolveBookingStaffId(
  teacherId: string,
  mappingsStaffToUser: Record<string, string>,
): number | null {
  const fromSynthetic = parseYclientsStaffUserId(teacherId);
  if (fromSynthetic) return fromSynthetic;

  for (const [staffId, userId] of Object.entries(mappingsStaffToUser)) {
    if (userId === teacherId) {
      const n = Number(staffId);
      return Number.isFinite(n) ? n : null;
    }
  }
  return null;
}
