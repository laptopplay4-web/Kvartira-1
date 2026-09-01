import type { Assignment } from '@/types';

export function sortAssignmentsByDate(assignments: Assignment[]): Assignment[] {
  return [...assignments].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export const HOME_ASSIGNMENTS_LIMIT = 3;

export function getRecentAssignmentsForHome(
  assignments: Assignment[],
  limit = HOME_ASSIGNMENTS_LIMIT,
): Assignment[] {
  return sortAssignmentsByDate(assignments).slice(0, limit);
}
