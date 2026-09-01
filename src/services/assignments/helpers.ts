import type { Assignment, AssignmentDisplayStatus } from '@/types';

export function getAssignmentDisplayStatus(assignment: Assignment): AssignmentDisplayStatus {
  if (assignment.status === 'assigned' && assignment.dueDate < todayISO()) {
    return 'overdue';
  }
  return assignment.status;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function sortAssignmentsByDueDate(assignments: Assignment[]): Assignment[] {
  return [...assignments].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export const HOME_ASSIGNMENTS_LIMIT = 3;

/** Assigned or submitted — still relevant on Home (not reviewed). */
export function filterPendingAssignments(assignments: Assignment[]): Assignment[] {
  return assignments.filter((a) => a.status === 'assigned' || a.status === 'submitted');
}

export function getUpcomingAssignmentsForHome(
  assignments: Assignment[],
  limit = HOME_ASSIGNMENTS_LIMIT,
): Assignment[] {
  return sortAssignmentsByDueDate(filterPendingAssignments(assignments)).slice(0, limit);
}
