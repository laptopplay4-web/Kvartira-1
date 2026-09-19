import type { AccountStatus, User } from '@/types';

export const ACCOUNT_STATUS_PENDING: AccountStatus = 'pending';
export const ACCOUNT_STATUS_ACTIVE: AccountStatus = 'active';

export const PENDING_REGISTRATION_NOTIFY_TITLE = 'Новая заявка на регистрацию';
export const PENDING_REGISTRATION_NOTIFY_LINK = '/admin/registrations';

export const ACCOUNT_APPROVED_NOTIFY_TITLE = 'Аккаунт подтверждён';
export const ACCOUNT_APPROVED_NOTIFY_BODY =
  'Администратор подтвердил ваш аккаунт. Можно пользоваться приложением.';
export const ACCOUNT_APPROVED_NOTIFY_LINK = '/home';

export function resolveAccountStatus(user: Pick<User, 'accountStatus' | 'role'> | null | undefined): AccountStatus {
  if (!user) return ACCOUNT_STATUS_ACTIVE;
  if (user.role === 'admin') return ACCOUNT_STATUS_ACTIVE;
  return user.accountStatus === ACCOUNT_STATUS_PENDING
    ? ACCOUNT_STATUS_PENDING
    : ACCOUNT_STATUS_ACTIVE;
}

export function isAccountPending(user: Pick<User, 'accountStatus' | 'role'> | null | undefined): boolean {
  return resolveAccountStatus(user) === ACCOUNT_STATUS_PENDING;
}

export function isAccountActive(user: Pick<User, 'accountStatus' | 'role'> | null | undefined): boolean {
  return resolveAccountStatus(user) === ACCOUNT_STATUS_ACTIVE;
}

export function countPendingRegistrations(users: User[] | null | undefined): number {
  if (!users?.length) return 0;
  return users.filter((u) => isAccountPending(u)).length;
}

export function filterPendingRegistrations(users: User[] | null | undefined): User[] {
  if (!users?.length) return [];
  return users.filter((u) => isAccountPending(u));
}

export function pendingRegistrationNotifyBody(user: Pick<User, 'firstName' | 'lastName' | 'role'>): string {
  const name = `${user.firstName} ${user.lastName}`.trim() || 'Пользователь';
  const roleLabel = user.role === 'teacher' ? 'преподаватель' : 'ученик';
  return `${name} (${roleLabel}) ожидает подтверждения.`;
}
