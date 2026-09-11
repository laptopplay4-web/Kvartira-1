import { ClientResponseError } from 'pocketbase';
import type { AssignmentGroup, AssignmentGroupDetail, User } from '@/types';
import { ApiError } from '@/services/api/types';
import type {
  AssignmentGroupsApi,
  CreateAssignmentGroupInput,
  UpdateAssignmentGroupInput,
} from '@/services/api/types';
import { getPocketBase } from '@/services/api/pocketbase/client';
import { withPbError } from '@/services/api/pocketbase/errors';
import { mapAssignmentGroupRecord, mapUserRecord } from '@/services/api/pocketbase/mappers';
import { resolveUsersAvatars } from '@/services/api/pocketbase/files';
import { pbEqOr, escapePbFilter } from '@/services/api/pocketbase/helpers';
import {
  canEditAssignmentGroup,
  canManageAssignmentGroups,
  canViewAssignmentGroup,
} from '@/services/assignments/groups/access';
import { isGeneralAssignmentGroup } from '@/services/assignments/groups/helpers';
import { validateGroupName } from '@/services/assignments/validation';

async function getRequesterUser(userId: string): Promise<User> {
  const pb = getPocketBase();
  try {
    const record = await pb.collection('users').getOne(userId);
    return mapUserRecord(record);
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      throw new ApiError('Пользователь не найден', 'NOT_FOUND', 404);
    }
    throw error;
  }
}

async function loadGroupOrThrow(id: string): Promise<AssignmentGroup> {
  const pb = getPocketBase();
  try {
    const record = await pb.collection('assignment_groups').getOne(id);
    return mapAssignmentGroupRecord(record);
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      throw new ApiError('Группа не найдена', 'NOT_FOUND', 404);
    }
    throw error;
  }
}

async function loadMembers(memberIds: string[]): Promise<User[]> {
  if (memberIds.length === 0) return [];
  const pb = getPocketBase();
  const filter = pbEqOr('id', memberIds);
  const records = await pb.collection('users').getFullList({ filter });
  const byId = new Map(records.map((r) => [r.id, mapUserRecord(r)]));
  const members = memberIds.map((id) => byId.get(id)).filter((u): u is User => !!u);
  return resolveUsersAvatars(members);
}

export const pocketbaseAssignmentGroupsApi: AssignmentGroupsApi = {
  async getGroups(requesterId) {
    return withPbError(async () => {
      const user = await getRequesterUser(requesterId);
      const pb = getPocketBase();
      const records = await pb.collection('assignment_groups').getFullList({ sort: 'name' });
      return records
        .map(mapAssignmentGroupRecord)
        .filter((group) => canViewAssignmentGroup(user, group));
    });
  },

  async getGroup(id, requesterId) {
    return withPbError(async () => {
      const user = await getRequesterUser(requesterId);
      const group = await loadGroupOrThrow(id);
      if (!canViewAssignmentGroup(user, group)) {
        throw new ApiError('Нет доступа к группе', 'FORBIDDEN', 403);
      }
      const members = await loadMembers(group.memberIds);
      const detail: AssignmentGroupDetail = {
        ...group,
        members,
        canManage: canEditAssignmentGroup(user, group),
      };
      return detail;
    });
  },

  async createGroup(input: CreateAssignmentGroupInput, requesterId) {
    const user = await getRequesterUser(requesterId);
    if (!canManageAssignmentGroups(user)) {
      throw new ApiError('Нет прав на создание группы', 'FORBIDDEN', 403);
    }
    const nameResult = validateGroupName(input.name);
    if (!nameResult.valid) throw new ApiError(nameResult.message, 'VALIDATION_ERROR', 400);

    return withPbError(async () => {
      const pb = getPocketBase();
      const record = await pb.collection('assignment_groups').create({
        name: input.name.trim(),
        teacher: requesterId,
        kind: 'custom',
        members: [],
      });
      return mapAssignmentGroupRecord(record);
    });
  },

  async updateGroup(id, input: UpdateAssignmentGroupInput, requesterId) {
    const user = await getRequesterUser(requesterId);
    const group = await loadGroupOrThrow(id);
    if (!canEditAssignmentGroup(user, group)) {
      throw new ApiError('Нет прав на управление группой', 'FORBIDDEN', 403);
    }
    const nameResult = validateGroupName(input.name);
    if (!nameResult.valid) throw new ApiError(nameResult.message, 'VALIDATION_ERROR', 400);

    return withPbError(async () => {
      const pb = getPocketBase();
      const record = await pb.collection('assignment_groups').update(id, {
        name: input.name.trim(),
      });
      return mapAssignmentGroupRecord(record);
    });
  },

  async addMember(groupId, studentId, requesterId) {
    const user = await getRequesterUser(requesterId);
    const group = await loadGroupOrThrow(groupId);
    if (!canEditAssignmentGroup(user, group)) {
      throw new ApiError('Нет прав на управление группой', 'FORBIDDEN', 403);
    }

    const student = await getRequesterUser(studentId);
    if (student.role !== 'student') {
      throw new ApiError('В группу можно добавить только ученика', 'VALIDATION_ERROR', 400);
    }

    const memberIds = group.memberIds.includes(studentId)
      ? group.memberIds
      : [...group.memberIds, studentId];

    return withPbError(async () => {
      const pb = getPocketBase();
      const record = await pb.collection('assignment_groups').update(groupId, {
        members: memberIds,
      });
      return mapAssignmentGroupRecord(record);
    });
  },

  async removeMember(groupId, studentId, requesterId) {
    const user = await getRequesterUser(requesterId);
    const group = await loadGroupOrThrow(groupId);
    if (!canEditAssignmentGroup(user, group)) {
      throw new ApiError('Нет прав на управление группой', 'FORBIDDEN', 403);
    }

    return withPbError(async () => {
      const pb = getPocketBase();
      const record = await pb.collection('assignment_groups').update(groupId, {
        members: group.memberIds.filter((id) => id !== studentId),
      });
      return mapAssignmentGroupRecord(record);
    });
  },

  async deleteGroup(id, requesterId) {
    const user = await getRequesterUser(requesterId);
    const group = await loadGroupOrThrow(id);
    if (isGeneralAssignmentGroup(group)) {
      throw new ApiError('Общую группу нельзя удалить', 'FORBIDDEN', 403);
    }
    if (!canEditAssignmentGroup(user, group)) {
      throw new ApiError('Нет прав на управление группой', 'FORBIDDEN', 403);
    }

    return withPbError(async () => {
      const pb = getPocketBase();
      // Cascade before group delete — assignments.group is required without cascadeDelete.
      const linked = await pb.collection('assignments').getFullList({
        filter: `group = "${escapePbFilter(id)}"`,
        fields: 'id',
      });
      await Promise.all(linked.map((row) => pb.collection('assignments').delete(row.id)));
      await pb.collection('assignment_groups').delete(id);
    });
  },
};
