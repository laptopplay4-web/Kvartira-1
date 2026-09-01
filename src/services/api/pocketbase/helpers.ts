/** Extract relation id from PocketBase record field (id string or expanded record). */
export function relId(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value) {
    return String((value as { id: string }).id);
  }
  return '';
}

/** PocketBase date fields may include time — keep YYYY-MM-DD for app types. */
export function normalizePbDate(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  return value.slice(0, 10);
}

export function emptyToUndefined(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  return value;
}

/** Escape a value for PocketBase filter strings. */
export function escapePbFilter(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** `field = "a" || field = "b"` — empty ids → empty string. */
export function pbEqOr(field: string, ids: string[]): string {
  if (ids.length === 0) return '';
  return ids.map((id) => `${field} = "${escapePbFilter(id)}"`).join(' || ');
}

/** PocketBase datetime may use a space instead of `T`. */
export function normalizePbDateTime(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const trimmed = value.trim();
  if (trimmed.includes(' ') && !trimmed.includes('T')) {
    return trimmed.replace(' ', 'T');
  }
  return trimmed;
}

/** `created` autodate — custom base collections may omit it until migration. */
export function getPbRecordCreatedAt(
  record: { created?: string },
  fallback?: string,
): string {
  const created = normalizePbDateTime(record.created);
  if (created) return created;
  const fb = normalizePbDateTime(fallback);
  if (fb) return fb;
  return new Date().toISOString();
}

/** `updated` autodate — falls back to created or explicit field. */
export function getPbRecordUpdatedAt(
  record: { created?: string; updated?: string },
  fallback?: string,
): string {
  const updated = normalizePbDateTime(record.updated);
  if (updated) return updated;
  const fb = normalizePbDateTime(fallback);
  if (fb) return fb;
  return getPbRecordCreatedAt(record, fallback);
}
