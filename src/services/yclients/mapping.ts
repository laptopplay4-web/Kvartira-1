import {
  EMPTY_YCLIENTS_MAPPINGS,
  type YclientsMappings,
} from '@/services/yclients/types';
import { coerceJsonObject } from '@/services/school/helpers';

export function normalizeYclientsMappings(raw: unknown): YclientsMappings {
  const obj = coerceJsonObject(raw);
  if (!obj) return { ...EMPTY_YCLIENTS_MAPPINGS, directionToServiceIds: {}, staffToUserId: {} };

  const directionToServiceIds: Record<string, number[]> = {};
  const dirRaw = coerceJsonObject(obj.directionToServiceIds) ?? {};
  for (const [directionId, value] of Object.entries(dirRaw)) {
    const ids = Array.isArray(value)
      ? value.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0)
      : [];
    if (ids.length > 0) directionToServiceIds[directionId] = ids;
  }

  const staffToUserId: Record<string, string> = {};
  const staffRaw = coerceJsonObject(obj.staffToUserId) ?? {};
  for (const [staffId, userId] of Object.entries(staffRaw)) {
    if (typeof userId === 'string' && userId.trim()) {
      staffToUserId[String(staffId)] = userId.trim();
    }
  }

  return { directionToServiceIds, staffToUserId };
}

export function extractYclientsMappingsFromContacts(contactsRaw: unknown): YclientsMappings {
  const obj = coerceJsonObject(contactsRaw);
  return normalizeYclientsMappings(obj?.yclientsMappings);
}

/** First mapped service for a direction, or null. */
export function resolveServiceIdForDirection(
  mappings: YclientsMappings,
  directionId: string,
): number | null {
  const ids = mappings.directionToServiceIds[directionId];
  if (!ids?.length) return null;
  return ids[0] ?? null;
}

export function resolveUserIdForStaff(
  mappings: YclientsMappings,
  staffId: number | string,
): string | null {
  const id = mappings.staffToUserId[String(staffId)];
  return id || null;
}

export function resolveStaffIdForUser(
  mappings: YclientsMappings,
  userId: string,
): number | null {
  for (const [staffId, mappedUserId] of Object.entries(mappings.staffToUserId)) {
    if (mappedUserId === userId) {
      const n = Number(staffId);
      return Number.isFinite(n) ? n : null;
    }
  }
  return null;
}

export function listMappedDirectionIds(mappings: YclientsMappings): string[] {
  return Object.keys(mappings.directionToServiceIds);
}
