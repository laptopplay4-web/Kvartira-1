import { can } from '@/permissions';
import type { AssignmentGroup, User } from '@/types';
import { isGeneralAssignmentGroup } from '@/services/assignments/groups/helpers';

export function canManageAssignmentGroups(user: User): boolean {
  return can(user, 'assignments:manage-groups');
}

export function canViewAssignmentGroup(user: User, group: AssignmentGroup): boolean {
  if (can(user, 'assignments:view-all')) return true;
  if (isGeneralAssignmentGroup(group.id) && canManageAssignmentGroups(user)) return true;
  if (canManageAssignmentGroups(user) && group.teacherId === user.id) return true;
  if (can(user, 'assignments:view-own') && group.memberIds.includes(user.id)) return true;
  if (can(user, 'assignments:view-own') && isGeneralAssignmentGroup(group.id)) return true;
  return false;
}

export function canEditAssignmentGroup(user: User, group: AssignmentGroup): boolean {
  if (isGeneralAssignmentGroup(group.id)) return false;
  if (!canManageAssignmentGroups(user)) return false;
  if (user.role === 'admin') return true;
  return group.teacherId === user.id;
}
