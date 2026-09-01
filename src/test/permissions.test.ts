import { describe, it, expect } from 'vitest';
import { can } from '@/permissions';
import type { User } from '@/types';

const student: User = { id: '1', phone: '+7', role: 'student', firstName: 'A', lastName: 'B' };
const teacher: User = { id: '2', phone: '+7', role: 'teacher', firstName: 'C', lastName: 'D' };
const admin: User = { id: '3', phone: '+7', role: 'admin', firstName: 'E', lastName: 'F' };

describe('permissions', () => {
  it('student can book lessons', () => {
    expect(can(student, 'lessons:book')).toBe(true);
    expect(can(student, 'assignments:view-own')).toBe(true);
    expect(can(student, 'progress:view-own')).toBe(true);
    expect(can(student, 'support:view-faq')).toBe(true);
    expect(can(student, 'security:view-own')).toBe(true);
    expect(can(student, 'legal:view-own')).toBe(true);
    expect(can(student, 'admin:access')).toBe(false);
  });

  it('teacher can manage availability', () => {
    expect(can(teacher, 'availability:manage')).toBe(true);
    expect(can(teacher, 'assignments:create')).toBe(true);
    expect(can(teacher, 'assignments:manage-groups')).toBe(true);
    expect(can(teacher, 'progress:view-assigned')).toBe(true);
    expect(can(teacher, 'progress:manage-goals')).toBe(true);
    expect(can(teacher, 'progress:manage-skills')).toBe(true);
    expect(can(teacher, 'lessons:book')).toBe(false);
  });

  it('admin has admin access', () => {
    expect(can(admin, 'admin:access')).toBe(true);
    expect(can(admin, 'admin:schedule')).toBe(true);
    expect(can(admin, 'admin:users')).toBe(true);
    expect(can(admin, 'progress:view-all')).toBe(true);
    expect(can(admin, 'progress:manage-goals')).toBe(true);
    expect(can(admin, 'support:reply-ticket')).toBe(true);
    expect(can(admin, 'support:manage-faq')).toBe(true);
    expect(can(admin, 'legal:manage')).toBe(true);
    expect(can(admin, 'admin:events')).toBe(true);
    expect(can(admin, 'admin:school-settings')).toBe(true);
  });

  it('teacher lacks admin permissions', () => {
    expect(can(teacher, 'admin:access')).toBe(false);
    expect(can(teacher, 'admin:schedule')).toBe(false);
    expect(can(teacher, 'admin:users')).toBe(false);
    expect(can(teacher, 'admin:events')).toBe(false);
    expect(can(teacher, 'admin:school-settings')).toBe(false);
  });

  it('null user has no permissions', () => {
    expect(can(null, 'lessons:book')).toBe(false);
  });
});
