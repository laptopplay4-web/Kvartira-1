import { describe, it, expect, beforeEach } from 'vitest';
import {
  mockChatApi,
  mockNotificationsApi,
  mockUsersApi,
  resetMockDatabase,
} from '@/services/api/mock/index';
import {
  canChangeUserRole,
  canToggleUserStaffRole,
  getToggledStaffRole,
  getUserRoleChangeError,
} from '@/services/users/access';
import { filterUsersBySearchQuery, sanitizeUserPhoneForViewer, preserveOwnPhone, dedupeUsersById } from '@/services/users/helpers';
import { users } from '@/mocks/seed';
import type { User } from '@/types';

const student = users.find((u) => u.id === 'user-student')!;
const teacher = users.find((u) => u.id === 'user-teacher-1')!;
const admin = users.find((u) => u.role === 'admin')!;

describe('admin user role change access', () => {
  it('toggles student ↔ teacher', () => {
    expect(getToggledStaffRole('student')).toBe('teacher');
    expect(getToggledStaffRole('teacher')).toBe('student');
    expect(getToggledStaffRole('admin')).toBeNull();
  });

  it('allows admin to change student and teacher roles', () => {
    expect(canToggleUserStaffRole(admin, student)).toBe(true);
    expect(canToggleUserStaffRole(admin, teacher)).toBe(true);
    expect(canChangeUserRole(admin, student, 'teacher')).toBe(true);
    expect(canChangeUserRole(admin, teacher, 'student')).toBe(true);
  });

  it('rejects admin, self, and non-admin requesters', () => {
    expect(canToggleUserStaffRole(admin, admin)).toBe(false);
    expect(canChangeUserRole(admin, admin, 'teacher')).toBe(false);
    expect(canChangeUserRole(admin, student, 'admin')).toBe(false);
    expect(canChangeUserRole(student, teacher, 'student')).toBe(false);
    expect(canChangeUserRole(teacher, student, 'teacher')).toBe(false);
    expect(getUserRoleChangeError(admin, student, 'teacher')).toBeNull();
    expect(getUserRoleChangeError(admin, student, 'student')).toBe('Роль уже установлена');
    expect(getUserRoleChangeError(admin, admin, 'teacher')).toBe(
      'Нельзя изменить собственную роль',
    );
  });
});

describe('filterUsersBySearchQuery', () => {
  it('filters by first name, last name, full name, and phone digits', () => {
    const pool = [student, teacher];
    expect(filterUsersBySearchQuery(pool, '')).toEqual(pool);
    expect(filterUsersBySearchQuery(pool, student.firstName)).toEqual([student]);
    expect(filterUsersBySearchQuery(pool, student.lastName)).toEqual([student]);
    expect(filterUsersBySearchQuery(pool, `${student.firstName} ${student.lastName}`)).toEqual([student]);
    expect(filterUsersBySearchQuery(pool, student.phone.slice(-4))).toEqual([student]);
    expect(filterUsersBySearchQuery(pool, 'zzz')).toEqual([]);
  });

  it('skips missing phone without throwing', () => {
    const withoutPhone = { ...student, phone: undefined as unknown as string };
    expect(filterUsersBySearchQuery([withoutPhone], student.firstName)).toEqual([withoutPhone]);
  });
});

describe('dedupeUsersById', () => {
  it('keeps first occurrence and drops duplicate ids', () => {
    const dup = { ...student, firstName: 'Дубль' };
    const other = { ...teacher, id: 'user-other' };
    expect(dedupeUsersById([student, dup, other])).toEqual([student, other]);
    expect(dedupeUsersById([])).toEqual([]);
    expect(dedupeUsersById([student])).toEqual([student]);
  });
});

describe('preserveOwnPhone', () => {
  it('restores own phone when API response omitted it', () => {
    const hidden = { ...student, phone: '' };
    expect(preserveOwnPhone(hidden, student.id, student.phone).phone).toBe(student.phone);
    expect(preserveOwnPhone(teacher, student.id, student.phone).phone).toBe(teacher.phone);
  });
});

describe('sanitizeUserPhoneForViewer', () => {
  it('keeps own phone and hides others unless admin', () => {
    expect(sanitizeUserPhoneForViewer(student, student).phone).toBe(student.phone);
    expect(sanitizeUserPhoneForViewer(teacher, student).phone).toBe('');
    expect(sanitizeUserPhoneForViewer(student, admin).phone).toBe(student.phone);
  });
});

describe('admin updateUserRole API', () => {
  beforeEach(() => {
    resetMockDatabase();
  });

  it('promotes student to teacher and notifies', async () => {
    const updated = await mockUsersApi.updateUserRole(admin.id, student.id, 'teacher');
    expect(updated.role).toBe('teacher');

    const stored = await mockUsersApi.getUser(student.id, admin.id);
    expect(stored.role).toBe('teacher');

    const notifications = await mockNotificationsApi.getNotifications(student.id);
    expect(notifications.some((n) => n.title === 'Роль изменена' && n.body.includes('Преподаватель'))).toBe(
      true,
    );
  });

  it('demotes teacher to student', async () => {
    const updated = await mockUsersApi.updateUserRole(admin.id, teacher.id, 'student');
    expect(updated.role).toBe('student');
  });

  it('rejects non-admin requester', async () => {
    await expect(mockUsersApi.updateUserRole(student.id, teacher.id, 'student')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('rejects changing admin or promoting to admin', async () => {
    await expect(mockUsersApi.updateUserRole(admin.id, admin.id, 'teacher')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    await expect(
      mockUsersApi.updateUserRole(admin.id, student.id, 'admin' as User['role'] as 'teacher'),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('self-service personal data rights', () => {
  beforeEach(() => {
    resetMockDatabase();
  });

  it('exports the requester profile and related records', async () => {
    const data = await mockUsersApi.exportOwnData(student.id);
    expect(data.profile.id).toBe(student.id);
    expect(data.exportedAt).toBeTruthy();
    expect(Array.isArray(data.consents)).toBe(true);
    expect(Array.isArray(data.lessons)).toBe(true);
  });

  it('deletes the requester account from the mock database', async () => {
    await mockUsersApi.deleteOwnAccount(student.id);
    await expect(mockUsersApi.getUser(student.id, admin.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('keeps personal chat history for the other party after account delete', async () => {
    const personal = await mockChatApi.createConversation('user-teacher-1', {
      type: 'personal',
      participantIds: [student.id],
    });
    await mockChatApi.sendMessage(personal.id, student.id, 'Привет от ученика');
    await mockUsersApi.deleteOwnAccount(student.id);

    const conv = await mockChatApi.getConversation(personal.id, 'user-teacher-1');
    expect(conv.participantIds).toContain('user-teacher-1');
    expect(conv.participantIds).not.toContain(student.id);

    const { messages } = await mockChatApi.getMessages(personal.id, 'user-teacher-1');
    expect(messages.some((m) => m.text?.includes('Привет'))).toBe(true);
  });
});
