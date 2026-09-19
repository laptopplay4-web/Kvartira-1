import { describe, it, expect, beforeEach } from 'vitest';
import {
  mockAuthApi,
  mockNotificationsApi,
  mockUsersApi,
  resetMockDatabase,
} from '@/services/api/mock/index';
import { users } from '@/mocks/seed';
import {
  canApproveUser,
  canRejectUser,
  getAccountApprovalError,
  getAccountRejectError,
} from '@/services/users/access';
import {
  countPendingRegistrations,
  filterPendingRegistrations,
  isAccountPending,
  resolveAccountStatus,
} from '@/services/users/accountStatus';
import { SEED_REGISTRATION_INVITE_TOKEN } from '@/services/registration/constants';
import type { User } from '@/types';

const student = users.find((u) => u.id === 'user-student')!;
const teacher = users.find((u) => u.id === 'user-teacher-1')!;
const admin = users.find((u) => u.role === 'admin')!;

describe('accountStatus helpers', () => {
  it('treats missing status as active; admin always active', () => {
    expect(resolveAccountStatus({ role: 'student' })).toBe('active');
    expect(resolveAccountStatus({ role: 'admin', accountStatus: 'pending' })).toBe('active');
    expect(isAccountPending({ role: 'student', accountStatus: 'pending' })).toBe(true);
    expect(isAccountPending(student)).toBe(false);
  });

  it('counts and filters pending registrations', () => {
    const pending: User = { ...student, id: 'p1', accountStatus: 'pending' };
    const list = [student, pending, admin];
    expect(countPendingRegistrations(list)).toBe(1);
    expect(filterPendingRegistrations(list).map((u) => u.id)).toEqual(['p1']);
  });
});

describe('account approval access', () => {
  it('allows admin to approve/reject pending only', () => {
    const pending: User = { ...student, accountStatus: 'pending' };
    expect(canApproveUser(admin, pending)).toBe(true);
    expect(canRejectUser(admin, pending)).toBe(true);
    expect(canApproveUser(admin, student)).toBe(false);
    expect(getAccountApprovalError(teacher, pending)).toBe('Нет доступа');
    expect(getAccountRejectError(admin, { ...admin, id: 'other-admin' })).toBe(
      'Нельзя отклонить администратора',
    );
  });
});

describe('mock register approval flow', () => {
  beforeEach(() => {
    resetMockDatabase();
  });

  it('register creates pending user and notifies admins', async () => {
    const session = await mockAuthApi.register(
      '+79001230001',
      'password1',
      'Новый',
      'Ученик',
      ['dir-vocal'],
      SEED_REGISTRATION_INVITE_TOKEN,
    );
    expect(session.user.accountStatus).toBe('pending');
    expect(isAccountPending(session.user)).toBe(true);

    const notifs = await mockNotificationsApi.getNotifications(admin.id);
    expect(notifs.some((n) => n.title === 'Новая заявка на регистрацию' && n.urgent)).toBe(true);
  });

  it('approve activates and notifies user; reject deletes and frees phone', async () => {
    const session = await mockAuthApi.register(
      '+79001230002',
      'password1',
      'Ждёт',
      'Одобрения',
      ['dir-vocal'],
      SEED_REGISTRATION_INVITE_TOKEN,
    );
    const pendingId = session.user.id;

    const approved = await mockUsersApi.approveUser(admin.id, pendingId);
    expect(approved.accountStatus).toBe('active');
    const userNotifs = await mockNotificationsApi.getNotifications(pendingId);
    expect(userNotifs.some((n) => n.title === 'Аккаунт подтверждён')).toBe(true);

    const session2 = await mockAuthApi.register(
      '+79001230003',
      'password1',
      'Снова',
      'Заявка',
      ['dir-vocal'],
      SEED_REGISTRATION_INVITE_TOKEN,
    );
    await mockUsersApi.rejectUser(admin.id, session2.user.id);
    await expect(mockUsersApi.getUser(session2.user.id, admin.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    const again = await mockAuthApi.register(
      '+79001230003',
      'password1',
      'Снова',
      'Заявка',
      ['dir-vocal'],
      SEED_REGISTRATION_INVITE_TOKEN,
    );
    expect(again.user.accountStatus).toBe('pending');
  });

  it('denies non-admin approve/reject', async () => {
    const session = await mockAuthApi.register(
      '+79001230004',
      'password1',
      'Чужой',
      'Approve',
      ['dir-vocal'],
      SEED_REGISTRATION_INVITE_TOKEN,
    );
    await expect(mockUsersApi.approveUser(student.id, session.user.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(mockUsersApi.rejectUser(teacher.id, session.user.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
