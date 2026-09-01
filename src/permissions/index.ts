import type { UserRole } from '@/types';

export type Permission =
  | 'lessons:view-own'
  | 'lessons:view-assigned'
  | 'lessons:view-all'
  | 'lessons:book'
  | 'lessons:reschedule-own'
  | 'lessons:cancel-own'
  | 'lessons:manage-own'
  | 'availability:manage'
  | 'students:view-assigned'
  | 'chat:read'
  | 'chat:write'
  | 'chat:send'
  | 'chat:create'
  | 'chat:manage_members'
  | 'chat:delete'
  | 'chat:delete_message'
  | 'chat:pin_message'
  | 'events:view'
  | 'events:register'
  | 'events:manage'
  | 'assignments:view-own'
  | 'assignments:view-assigned'
  | 'assignments:view-all'
  | 'assignments:create'
  | 'assignments:submit'
  | 'assignments:review'
  | 'progress:view-own'
  | 'progress:view-assigned'
  | 'progress:view-all'
  | 'progress:manage-goals'
  | 'progress:manage-skills'
  | 'admin:access'
  | 'admin:users'
  | 'admin:schedule'
  | 'admin:events'
  | 'admin:school-settings'
  | 'profile:view-own'
  | 'profile:edit-own'
  | 'notifications:view'
  | 'support:view-faq'
  | 'support:create-ticket'
  | 'support:view-own-tickets'
  | 'support:view-all-tickets'
  | 'support:reply-ticket'
  | 'support:manage-faq'
  | 'security:view-own'
  | 'security:manage-password'
  | 'security:manage-sessions'
  | 'legal:view-own'
  | 'legal:accept'
  | 'legal:manage';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  student: [
    'lessons:view-own',
    'lessons:book',
    'lessons:reschedule-own',
    'lessons:cancel-own',
    'chat:read',
    'chat:write',
    'chat:send',
    'chat:create',
    'chat:delete_message',
    'events:view',
    'events:register',
    'assignments:view-own',
    'assignments:submit',
    'progress:view-own',
    'profile:view-own',
    'profile:edit-own',
    'notifications:view',
    'support:view-faq',
    'support:create-ticket',
    'support:view-own-tickets',
    'security:view-own',
    'security:manage-password',
    'security:manage-sessions',
    'legal:view-own',
    'legal:accept',
  ],
  teacher: [
    'lessons:view-own',
    'lessons:view-assigned',
    'lessons:manage-own',
    'lessons:reschedule-own',
    'lessons:cancel-own',
    'availability:manage',
    'students:view-assigned',
    'chat:read',
    'chat:write',
    'chat:send',
    'chat:create',
    'chat:manage_members',
    'chat:delete_message',
    'chat:pin_message',
    'events:view',
    'events:register',
    'events:manage',
    'assignments:view-assigned',
    'assignments:create',
    'assignments:review',
    'progress:view-assigned',
    'progress:manage-goals',
    'progress:manage-skills',
    'profile:view-own',
    'profile:edit-own',
    'notifications:view',
    'support:view-faq',
    'support:create-ticket',
    'support:view-own-tickets',
    'security:view-own',
    'security:manage-password',
    'security:manage-sessions',
    'legal:view-own',
    'legal:accept',
  ],
  admin: [
    'lessons:view-all',
    'lessons:manage-own',
    'lessons:book',
    'lessons:reschedule-own',
    'lessons:cancel-own',
    'availability:manage',
    'students:view-assigned',
    'chat:read',
    'chat:write',
    'chat:send',
    'chat:create',
    'chat:manage_members',
    'chat:delete',
    'chat:delete_message',
    'chat:pin_message',
    'events:view',
    'events:register',
    'events:manage',
    'assignments:view-all',
    'progress:view-all',
    'progress:manage-goals',
    'progress:manage-skills',
    'admin:access',
    'admin:users',
    'admin:schedule',
    'admin:events',
    'admin:school-settings',
    'profile:view-own',
    'profile:edit-own',
    'notifications:view',
    'support:view-faq',
    'support:create-ticket',
    'support:view-own-tickets',
    'support:view-all-tickets',
    'support:reply-ticket',
    'support:manage-faq',
    'security:view-own',
    'security:manage-password',
    'security:manage-sessions',
    'legal:view-own',
    'legal:accept',
    'legal:manage',
  ],
};

export function can(
  user: { role: UserRole } | null | undefined,
  permission: Permission,
): boolean {
  if (!user) return false;
  return ROLE_PERMISSIONS[user.role].includes(permission);
}

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    student: 'Ученик',
    teacher: 'Преподаватель',
    admin: 'Администратор',
  };
  return labels[role];
}
