import { formatUserName } from '@/utils';
import type { User } from '@/types';

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
