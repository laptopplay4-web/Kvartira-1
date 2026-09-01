import { can } from '@/permissions';
import type { Assignment, AssignmentGroup, User } from '@/types';
import { isGeneralAssignmentGroup } from '@/services/assignments/groups/helpers';

export function canViewAssignment(
  user: User,
  assignment: Assignment,
  groups: AssignmentGroup[],
): boolean {
  if (can(user, 'assignments:view-all')) return true;
  if (can(user, 'assignments:view-assigned') && assignment.teacherId === user.id) return true;
  if (can(user, 'assignments:view-own')) {
    if (isGeneralAssignmentGroup(assignment.groupId)) return true;
    const group = groups.find((g) => g.id === assignment.groupId);
    return group?.memberIds.includes(user.id) ?? false;
  }
  return false;
}

export function canCreateAssignment(user: User): boolean {
  return can(user, 'assignments:create');
}
