import type { AssignmentGroup, User } from '@/types';

export const GENERAL_ASSIGNMENT_GROUP_ID = 'grp-general';
export const GENERAL_ASSIGNMENT_GROUP_LABEL = 'Общее задание';

export function isGeneralAssignmentGroup(groupId: string): boolean {
  return groupId === GENERAL_ASSIGNMENT_GROUP_ID;
}

export function isCustomAssignmentGroup(group: AssignmentGroup): boolean {
  return group.id !== GENERAL_ASSIGNMENT_GROUP_ID;
}

export function getAssignmentGroupLabel(
  groupId: string,
  groups: AssignmentGroup[],
): string {
  if (isGeneralAssignmentGroup(groupId)) return GENERAL_ASSIGNMENT_GROUP_LABEL;
  return groups.find((g) => g.id === groupId)?.name ?? '';
}

export function sortRecipientGroups(groups: AssignmentGroup[]): AssignmentGroup[] {
  return [...groups]
    .filter(isCustomAssignmentGroup)
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export function isUserAmongMembers(user: User, members: User[]): boolean {
  return members.some(
    (member) => member.id === user.id || (member.phone === user.phone && member.role === user.role),
  );
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
  if (!student.directionIds?.length) return '';
  return directions
    .filter((d) => student.directionIds!.includes(d.id))
    .map((d) => d.name)
    .join(' · ');
}
