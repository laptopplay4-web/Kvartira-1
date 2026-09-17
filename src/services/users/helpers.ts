import { formatUserName } from '@/utils';
import type { Direction, User, UserRole } from '@/types';

/** Display order: admins → teachers → students. */
const ROLE_SORT_RANK: Record<UserRole, number> = {
  admin: 0,
  teacher: 1,
  student: 2,
};

/** Compare by school role, then full name A→Z (`ru`). */
export function compareUsersByRoleAndName(
  a: Pick<User, 'role' | 'firstName' | 'lastName'>,
  b: Pick<User, 'role' | 'firstName' | 'lastName'>,
): number {
  const byRole = (ROLE_SORT_RANK[a.role] ?? 99) - (ROLE_SORT_RANK[b.role] ?? 99);
  if (byRole !== 0) return byRole;
  const nameA = formatUserName({
    firstName: a.firstName ?? '',
    lastName: a.lastName ?? '',
  });
  const nameB = formatUserName({
    firstName: b.firstName ?? '',
    lastName: b.lastName ?? '',
  });
  return nameA.localeCompare(nameB, 'ru', { sensitivity: 'base' });
}

/** Admins A→Z, then teachers A→Z, then students A→Z. */
export function sortUsersByRoleAndName<T extends Pick<User, 'role' | 'firstName' | 'lastName'>>(
  users: T[],
): T[] {
  return [...users].sort(compareUsersByRoleAndName);
}

/** Названия направлений пользователя через « · ». */
export function formatUserDirectionLabels(
  user: Pick<User, 'directionIds'>,
  directions: Pick<Direction, 'id' | 'name'>[],
): string {
  return resolveUserDirections(user, directions)
    .map((d) => d.name)
    .join(' · ');
}

/** Список направлений пользователя (порядок как в directionIds). */
export function resolveUserDirections(
  user: Pick<User, 'directionIds'>,
  directions: Pick<Direction, 'id' | 'name'>[],
): Pick<Direction, 'id' | 'name'>[] {
  if (!user.directionIds?.length) return [];
  const byId = new Map(directions.map((d) => [d.id, d]));
  return user.directionIds
    .map((id) => byId.get(id))
    .filter((d): d is Pick<Direction, 'id' | 'name'> => !!d);
}

function normalizeUserSearchQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Own phone + admin list only; hidden for other users in API/UI. */
export function sanitizeUserPhoneForViewer(
  user: User,
  viewer: Pick<User, 'id' | 'role'> | null | undefined,
): User {
  if (!viewer) return { ...user, phone: '' };
  if (user.id === viewer.id) return user;
  if (viewer.role === 'admin') return user;
  return { ...user, phone: '' };
}

export function sanitizeUsersPhoneForViewer(
  users: User[],
  viewer: Pick<User, 'id' | 'role'> | null | undefined,
): User[] {
  return users.map((user) => sanitizeUserPhoneForViewer(user, viewer));
}

/** Keep own phone when API omits it (PB enrich / profile update). */
export function preserveOwnPhone(user: User, viewerId: string, fallback?: string): User {
  if (user.id !== viewerId || user.phone) return user;
  if (fallback) return { ...user, phone: fallback };
  return user;
}

export function filterUsersBySearchQuery(users: User[], query: string): User[] {
  const normalized = normalizeUserSearchQuery(query);
  if (!normalized) return users;

  return users.filter((user) => {
    const fullName = formatUserName({
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
    }).toLowerCase();
    const firstName = (user.firstName ?? '').toLowerCase();
    const lastName = (user.lastName ?? '').toLowerCase();
    const phone = (user.phone ?? '').replace(/\D/g, '');
    const queryDigits = normalized.replace(/\D/g, '');

    return (
      fullName.includes(normalized) ||
      firstName.includes(normalized) ||
      lastName.includes(normalized) ||
      (queryDigits.length > 0 && phone.includes(queryDigits))
    );
  });
}

/** Stable unique list by `id` (first occurrence wins) — avoids phantom «Выбрать всех (N)». */
export function dedupeUsersById(users: User[]): User[] {
  if (users.length <= 1) return users;
  const seen = new Set<string>();
  const result: User[] = [];
  for (const user of users) {
    if (!user?.id || seen.has(user.id)) continue;
    seen.add(user.id);
    result.push(user);
  }
  return result;
}
