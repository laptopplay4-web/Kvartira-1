import { beforeEach, describe, expect, it } from 'vitest';
import { mockAuthApi, mockLessonsApi, mockUsersApi, resetMockDatabase } from '@/services/api/mock';
import { DEMO_ACCOUNTS, users } from '@/mocks/seed';
import { canManageDirections, needsTeacherDirectionSetup } from '@/services/directions/access';
import {
  normalizeDirectionIds,
  validateDirectionIdsSelection,
  validateDirectionInput,
} from '@/services/directions/validation';
import { TEACHER_DIRECTIONS_SETUP_TITLE } from '@/services/directions/constants';
import { can } from '@/permissions';
import { SEED_REGISTRATION_INVITE_TOKEN } from '@/services/registration/constants';

const admin = users.find((u) => u.id === 'user-admin')!;
const student = users.find((u) => u.id === 'user-student')!;
const teacher = users.find((u) => u.id === 'user-teacher-1')!;

describe('directions domain', () => {
  it('admin can manage directions', () => {
    expect(canManageDirections(admin)).toBe(true);
    expect(can(admin, 'admin:directions')).toBe(true);
    expect(canManageDirections(teacher)).toBe(false);
    expect(canManageDirections(student)).toBe(false);
  });

  it('needsTeacherDirectionSetup only for teacher without ids', () => {
    expect(needsTeacherDirectionSetup({ role: 'teacher', directionIds: [] })).toBe(true);
    expect(needsTeacherDirectionSetup({ role: 'teacher', directionIds: ['dir-vocal'] })).toBe(false);
    expect(needsTeacherDirectionSetup({ role: 'student', directionIds: [] })).toBe(false);
    expect(needsTeacherDirectionSetup({ role: 'admin', directionIds: [] })).toBe(false);
  });

  it('validateDirectionInput requires name', () => {
    expect(validateDirectionInput({ name: 'А' })).toContain('Название');
    expect(validateDirectionInput({ name: 'Вокал' })).toBeNull();
  });

  it('validateDirectionIdsSelection requires known ids', () => {
    const available = [{ id: 'dir-vocal' }, { id: 'dir-guitar' }];
    expect(validateDirectionIdsSelection([], available)).toContain('хотя бы одно');
    expect(validateDirectionIdsSelection(['dir-unknown'], available)).toContain('неизвестное');
    expect(validateDirectionIdsSelection(['dir-vocal', 'dir-vocal'], available)).toBeNull();
    expect(normalizeDirectionIds(['a', 'a', 'b'])).toEqual(['a', 'b']);
  });

  it('exposes music-school icon options for admin picker', async () => {
    const { DIRECTION_ICON_OPTIONS } = await import('@/services/directions/constants');
    expect(DIRECTION_ICON_OPTIONS).toContain('🎤');
    expect(DIRECTION_ICON_OPTIONS).toContain('🎸');
    expect(DIRECTION_ICON_OPTIONS).toContain('🎹');
    expect(DIRECTION_ICON_OPTIONS.length).toBeGreaterThanOrEqual(12);
  });
});

describe('directions admin CRUD (mock)', () => {
  beforeEach(() => {
    resetMockDatabase();
  });

  it('creates updates and lists directions', async () => {
    const created = await mockLessonsApi.createDirection(
      { name: 'Скрипка', description: 'Классика', icon: '🎻' },
      admin.id,
    );
    expect(created.name).toBe('Скрипка');
    const list = await mockLessonsApi.getDirections();
    expect(list.some((d) => d.id === created.id)).toBe(true);

    const updated = await mockLessonsApi.updateDirection(
      created.id,
      { name: 'Скрипка (adv)' },
      admin.id,
    );
    expect(updated.name).toBe('Скрипка (adv)');
  });

  it('forbids student create and blocks delete when in use', async () => {
    await expect(
      mockLessonsApi.createDirection({ name: 'Бас' }, student.id),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(mockLessonsApi.deleteDirection('dir-vocal', admin.id)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });
});

describe('register + teacher directions setup (mock)', () => {
  beforeEach(() => {
    resetMockDatabase();
  });

  it('register requires direction and stores ids', async () => {
    const invite = SEED_REGISTRATION_INVITE_TOKEN;
    await expect(
      mockAuthApi.register('+79009998877', 'password1', 'Тест', 'Ученик', [], invite),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    const session = await mockAuthApi.register(
      '+79009998877',
      'password1',
      'Тест',
      'Ученик',
      ['dir-guitar', 'dir-vocal'],
      invite,
    );
    expect(session.user.directionIds).toEqual(['dir-guitar', 'dir-vocal']);
  });

  it('promote to teacher clears directions and sends urgent notification', async () => {
    const promoted = await mockUsersApi.updateUserRole(admin.id, student.id, 'teacher');
    expect(promoted.role).toBe('teacher');
    expect(promoted.directionIds).toEqual([]);

    const login = await mockAuthApi.login(DEMO_ACCOUNTS.student.phone, DEMO_ACCOUNTS.student.password);
    const { mockNotificationsApi } = await import('@/services/api/mock');
    const notifications = await mockNotificationsApi.getNotifications(login.user.id);
    const urgent = notifications.filter((n) => n.urgent && n.title === TEACHER_DIRECTIONS_SETUP_TITLE);
    expect(urgent.length).toBeGreaterThanOrEqual(1);

    const saved = await mockUsersApi.updateProfile(login.user.id, {
      directionIds: ['dir-vocal', 'dir-piano'],
    });
    expect(saved.directionIds).toEqual(['dir-vocal', 'dir-piano']);

    const teachers = await mockLessonsApi.getTeachers('dir-piano');
    expect(teachers.some((t) => t.id === login.user.id)).toBe(true);
  });

  it('student can add another direction in profile', async () => {
    const updated = await mockUsersApi.updateProfile(student.id, {
      directionIds: ['dir-vocal', 'dir-guitar'],
    });
    expect(updated.directionIds).toEqual(['dir-vocal', 'dir-guitar']);
  });

  it('admin may set or clear directions without forced setup', async () => {
    expect(needsTeacherDirectionSetup(admin)).toBe(false);
    const withDirs = await mockUsersApi.updateProfile(admin.id, {
      directionIds: ['dir-vocal'],
    });
    expect(withDirs.directionIds).toEqual(['dir-vocal']);
    const cleared = await mockUsersApi.updateProfile(admin.id, { directionIds: [] });
    expect(cleared.directionIds).toEqual([]);
  });
});
