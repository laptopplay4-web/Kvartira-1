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
    const group = groups.find((g) => g.id === assignment.groupId);
    if (group ? isGeneralAssignmentGroup(group) : isGeneralAssignmentGroup(assignment.groupId)) {
      return true;
    }
    return group?.memberIds.includes(user.id) ?? false;
  }
  return false;
}

export function canCreateAssignment(user: User): boolean {
  return can(user, 'assignments:create');
}

/** Teacher/admin with create permission may edit or delete any assignment. */
export function canManageAssignment(user: User): boolean {
  return can(user, 'assignments:create');
}
