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

export function toMockUserId(users: User[], user: User): string {
  const match = users.find((u) => u.phone === user.phone && u.role === user.role);
  return match?.id ?? user.id;
}
