import { describe, it, expect } from 'vitest';
import { can, actsAsTeacher } from '@/permissions';
import type { User } from '@/types';

const student: User = { id: '1', phone: '+7', role: 'student', firstName: 'A', lastName: 'B' };
const teacher: User = { id: '2', phone: '+7', role: 'teacher', firstName: 'C', lastName: 'D' };
const admin: User = { id: '3', phone: '+7', role: 'admin', firstName: 'E', lastName: 'F' };

describe('permissions', () => {
  it('student can book lessons', () => {
    expect(can(student, 'lessons:book')).toBe(true);
    expect(can(student, 'assignments:view-own')).toBe(true);
    expect(can(student, 'support:view-faq')).toBe(true);
    expect(can(student, 'security:view-own')).toBe(true);
    expect(can(student, 'legal:view-own')).toBe(true);
    expect(can(student, 'chat:create')).toBe(false);
    expect(can(student, 'chat:delete')).toBe(false);
    expect(can(student, 'chat:pin_message')).toBe(false);
    expect(can(student, 'admin:access')).toBe(false);
  });

  it('teacher can manage availability', () => {
    expect(can(teacher, 'availability:manage')).toBe(true);
    expect(can(teacher, 'assignments:create')).toBe(true);
    expect(can(teacher, 'assignments:manage-groups')).toBe(true);
    expect(can(teacher, 'events:manage')).toBe(true);
    expect(can(teacher, 'chat:create')).toBe(true);
    expect(can(teacher, 'chat:delete')).toBe(true);
    expect(can(teacher, 'chat:pin_message')).toBe(true);
    expect(can(teacher, 'lessons:book')).toBe(false);
  });

  it('admin has admin access and teacher functions', () => {
    expect(can(admin, 'admin:access')).toBe(true);
    expect(can(admin, 'admin:schedule')).toBe(true);
    expect(can(admin, 'admin:users')).toBe(true);
    expect(can(admin, 'lessons:view-own')).toBe(true);
    expect(can(admin, 'lessons:view-assigned')).toBe(true);
    expect(can(admin, 'lessons:manage-own')).toBe(true);
    expect(can(admin, 'availability:manage')).toBe(true);
    expect(can(admin, 'assignments:create')).toBe(true);
    expect(can(admin, 'lessons:book')).toBe(false);
    expect(can(admin, 'support:reply-ticket')).toBe(true);
    expect(can(admin, 'support:manage-faq')).toBe(true);
    expect(can(admin, 'legal:manage')).toBe(true);
    expect(can(admin, 'admin:events')).toBe(true);
    expect(can(admin, 'admin:school-settings')).toBe(true);
    expect(can(admin, 'admin:directions')).toBe(true);
    expect(can(admin, 'chat:pin_message')).toBe(true);
    expect(actsAsTeacher(admin.role)).toBe(true);
    expect(actsAsTeacher(teacher.role)).toBe(true);
    expect(actsAsTeacher(student.role)).toBe(false);
  });

  it('teacher lacks admin permissions', () => {
    expect(can(teacher, 'admin:access')).toBe(false);
    expect(can(teacher, 'admin:schedule')).toBe(false);
    expect(can(teacher, 'admin:users')).toBe(false);
    expect(can(teacher, 'admin:events')).toBe(false);
    expect(can(teacher, 'admin:school-settings')).toBe(false);
    expect(can(teacher, 'admin:directions')).toBe(false);
  });

  it('null user has no permissions', () => {
    expect(can(null, 'lessons:book')).toBe(false);
  });

  it('user with missing or unknown role has no permissions', () => {
    expect(can({ role: undefined as unknown as User['role'] }, 'lessons:book')).toBe(false);
    expect(can({ role: 'guest' as User['role'] }, 'lessons:book')).toBe(false);
  });
});
