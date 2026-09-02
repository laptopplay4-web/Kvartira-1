import type { AssignmentGroup, AssignmentGroupDetail, User } from '@/types';
import {
  canEditAssignmentGroup,
  canManageAssignmentGroups,
  canViewAssignmentGroup,
} from '@/services/assignments/groups/access';
import { validateGroupName } from '@/services/assignments/validation';
import { ApiError } from '@/services/api/types';
import type {
  AssignmentGroupsApi,
  CreateAssignmentGroupInput,
  UpdateAssignmentGroupInput,
} from '@/services/api/types';
import { createLocalUserResolver, toMockUserId, type MockUserResolver } from '@/services/api/mock/userResolver';

export interface MockAssignmentGroupsDb {
  assignmentGroups: AssignmentGroup[];
  users: User[];
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createMockAssignmentGroupsApi(
  db: MockAssignmentGroupsDb,
  delay: (ms?: number) => Promise<void>,
  resolveUser: MockUserResolver = createLocalUserResolver(db.users),
): AssignmentGroupsApi {
  async function getUserById(userId: string): Promise<User> {
    return resolveUser(userId);
  }

  function getGroupById(id: string): AssignmentGroup {
    const group = db.assignmentGroups.find((g) => g.id === id);
    if (!group) throw new ApiError('Группа не найдена', 'NOT_FOUND', 404);
    return group;
  }

  async function assertViewAccess(group: AssignmentGroup, requesterId: string): Promise<User> {
    const user = await getUserById(requesterId);
    if (!canViewAssignmentGroup(user, group)) {
      throw new ApiError('Нет доступа к группе', 'FORBIDDEN', 403);
    }
    return user;
  }

  async function assertEditAccess(group: AssignmentGroup, requesterId: string): Promise<User> {
    const user = await getUserById(requesterId);
    if (!canEditAssignmentGroup(user, group)) {
      throw new ApiError('Нет прав на управление группой', 'FORBIDDEN', 403);
    }
    return user;
  }

  return {
    async getGroups(requesterId) {
      await delay();
      const user = await getUserById(requesterId);
      return db.assignmentGroups.filter((g) => canViewAssignmentGroup(user, g));
    },

    async getGroup(id, requesterId) {
      await delay();
      const group = getGroupById(id);
      const user = await assertViewAccess(group, requesterId);

      const members = group.memberIds
        .map((memberId) => db.users.find((u) => u.id === memberId))
        .filter((u): u is User => !!u);

      const detail: AssignmentGroupDetail = {
        ...group,
        members,
        canManage: canEditAssignmentGroup(user, group),
      };
      return detail;
    },

    async createGroup(input: CreateAssignmentGroupInput, requesterId) {
      await delay(150);
      const user = await getUserById(requesterId);
      if (!canManageAssignmentGroups(user)) {
        throw new ApiError('Нет прав на создание группы', 'FORBIDDEN', 403);
      }

      const nameResult = validateGroupName(input.name);
      if (!nameResult.valid) throw new ApiError(nameResult.message, 'VALIDATION_ERROR', 400);

      const now = new Date().toISOString();
      const group: AssignmentGroup = {
        id: uid('grp'),
        name: input.name.trim(),
        teacherId: toMockUserId(db.users, user),
        memberIds: [],
        createdAt: now,
        updatedAt: now,
      };

      db.assignmentGroups.push(group);
      return group;
    },

    async updateGroup(id, input: UpdateAssignmentGroupInput, requesterId) {
      await delay(150);
      const group = getGroupById(id);
      await assertEditAccess(group, requesterId);

      const nameResult = validateGroupName(input.name);
      if (!nameResult.valid) throw new ApiError(nameResult.message, 'VALIDATION_ERROR', 400);

      group.name = input.name.trim();
      group.updatedAt = new Date().toISOString();
      return group;
    },

    async addMember(groupId, studentId, requesterId) {
      await delay(150);
      const group = getGroupById(groupId);
      await assertEditAccess(group, requesterId);

      const student = await getUserById(studentId);
      if (student.role !== 'student') {
        throw new ApiError('В группу можно добавить только ученика', 'VALIDATION_ERROR', 400);
      }

      const normalizedId = toMockUserId(db.users, student);
      if (!group.memberIds.includes(normalizedId)) {
        group.memberIds.push(normalizedId);
        group.updatedAt = new Date().toISOString();
      }

      return group;
    },

    async removeMember(groupId, studentId, requesterId) {
      await delay(150);
      const group = getGroupById(groupId);
      await assertEditAccess(group, requesterId);

      const student = await getUserById(studentId);
      const normalizedId = toMockUserId(db.users, student);
      group.memberIds = group.memberIds.filter((id) => id !== normalizedId && id !== studentId);
      group.updatedAt = new Date().toISOString();
      return group;
    },

    async deleteGroup(id, requesterId) {
      await delay(150);
      const group = getGroupById(id);
      await assertEditAccess(group, requesterId);
      db.assignmentGroups = db.assignmentGroups.filter((g) => g.id !== id);
    },
  };
}
