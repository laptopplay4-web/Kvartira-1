import type { User } from '@/types';
import { ApiError } from '@/services/api/types';

export type MockUserResolver = (userId: string) => User | Promise<User>;

export function createLocalUserResolver(users: User[]): MockUserResolver {
  return (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) throw new ApiError('Пользователь не найден', 'NOT_FOUND', 404);
    return user;
  };
}

/** PocketBase auth ids → mock seed user by phone (hybrid PB + mock assignments). */
export function createHybridUserResolver(users: User[]): MockUserResolver {
  return async (userId: string) => {
    const cached = users.find((u) => u.id === userId);
    if (cached) return cached;

    const { pocketbaseUsersApi } = await import('@/services/api/pocketbase/users');
    const pbUser = await pocketbaseUsersApi.getUser(userId);
    const byPhone = users.find((u) => u.phone === pbUser.phone);
    return byPhone ?? pbUser;
  };
}

/** Resolve seed/mock member id to client-facing user (PB id when in hybrid mode). */
export async function resolveSeedMemberForClient(
  memberId: string,
  seedUsers: User[],
): Promise<User | null> {
  const seedUser = seedUsers.find((u) => u.id === memberId);
  if (!seedUser) return null;

  try {
    const { pocketbaseUsersApi } = await import('@/services/api/pocketbase/users');
    const directory = await pocketbaseUsersApi.getAllUsers();
    const match = directory.find(
      (u) => u.phone === seedUser.phone && u.role === seedUser.role,
    );
    return match ?? seedUser;
  } catch {
    return seedUser;
  }
}

export function toMockUserId(users: User[], user: User): string {
  const match = users.find((u) => u.phone === user.phone && u.role === user.role);
  return match?.id ?? user.id;
}
