import type { AssignmentGroup, User } from '@/types';
import { formatUserDirectionLabels } from '@/services/users/helpers';

export const GENERAL_ASSIGNMENT_GROUP_ID = 'grp-general';
export const GENERAL_ASSIGNMENT_GROUP_LABEL = 'Общее задание';

export function isGeneralAssignmentGroup(group: AssignmentGroup | string): boolean {
  if (typeof group === 'string') {
    return group === GENERAL_ASSIGNMENT_GROUP_ID;
  }
  return group.isGeneral === true || group.id === GENERAL_ASSIGNMENT_GROUP_ID;
}

export function isCustomAssignmentGroup(group: AssignmentGroup): boolean {
  return !isGeneralAssignmentGroup(group);
}

export function getAssignmentGroupLabel(
  groupId: string,
  groups: AssignmentGroup[],
): string {
  const group = groups.find((g) => g.id === groupId);
  if (group ? isGeneralAssignmentGroup(group) : isGeneralAssignmentGroup(groupId)) {
    return GENERAL_ASSIGNMENT_GROUP_LABEL;
  }
  return group?.name ?? '';
}

export function sortRecipientGroups(groups: AssignmentGroup[]): AssignmentGroup[] {
  return [...groups]
    .filter(isCustomAssignmentGroup)
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

function hasComparablePhone(phone: string | undefined | null): phone is string {
  return typeof phone === 'string' && phone.trim().length > 0;
}

/** Match by id; phone fallback only when both phones are non-empty (sanitized '' must not match). */
export function isUserAmongMembers(user: User, members: User[]): boolean {
  return members.some((member) => {
    if (member.id === user.id) return true;
    if (!hasComparablePhone(member.phone) || !hasComparablePhone(user.phone)) return false;
    return member.phone === user.phone && member.role === user.role;
  });
}

export type GroupMemberDirectionFilter = 'all' | string;

export function filterStudentsByDirection(
  students: User[],
  directionId: GroupMemberDirectionFilter,
): User[] {
  if (directionId === 'all') return students;
  return students.filter((student) => student.directionIds?.includes(directionId));
}

export function formatStudentDirectionLabels(
  student: User,
  directions: { id: string; name: string }[],
): string {
  return formatUserDirectionLabels(student, directions);
}
