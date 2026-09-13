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
import {
  GENERAL_ASSIGNMENT_GROUP_ID,
  GENERAL_ASSIGNMENT_GROUP_LABEL,
  isGeneralAssignmentGroup,
  isKindGeneralGroup,
} from '@/services/assignments/groups/helpers';
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

/**
 * PB ids ≠ mock `grp-general`. Find or create the school-wide general group.
 * Orphan customs named «Все ученики» are promoted or reassigned — never wipe assignments.
 */
export async function ensureGeneralAssignmentGroup(ownerTeacherId: string): Promise<AssignmentGroup> {
  const pb = getPocketBase();
  const all = (await pb.collection('assignment_groups').getFullList({ sort: '-id' })).map(
    mapAssignmentGroupRecord,
  );
  const kindGenerals = all.filter((g) => isKindGeneralGroup(g));
  const namedCustoms = all.filter(
    (g) => !isKindGeneralGroup(g) && g.name.trim() === GENERAL_ASSIGNMENT_GROUP_LABEL,
  );

  const reassignAssignmentsThenDelete = async (fromId: string, toId: string) => {
    if (fromId === toId) return;
    try {
      const linked = await pb.collection('assignments').getFullList({
        filter: `group = "${escapePbFilter(fromId)}"`,
        fields: 'id',
      });
      await Promise.all(
        linked.map((row) => pb.collection('assignments').update(row.id, { group: toId })),
      );
      await pb.collection('assignment_groups').delete(fromId);
    } catch {
      /* best-effort cleanup */
    }
  };

  if (kindGenerals[0]) {
    const general = kindGenerals[0];
    await Promise.all(namedCustoms.map((g) => reassignAssignmentsThenDelete(g.id, general.id)));
    return general;
  }

  if (namedCustoms[0]) {
    const promoted = await pb.collection('assignment_groups').update(namedCustoms[0].id, {
      kind: 'general',
      name: GENERAL_ASSIGNMENT_GROUP_LABEL,
    });
    const general = mapAssignmentGroupRecord(promoted);
    await Promise.all(
      namedCustoms.slice(1).map((g) => reassignAssignmentsThenDelete(g.id, general.id)),
    );
    return general;
  }

  const record = await pb.collection('assignment_groups').create({
    name: GENERAL_ASSIGNMENT_GROUP_LABEL,
    teacher: ownerTeacherId,
    kind: 'general',
    members: [],
  });
  return mapAssignmentGroupRecord(record);
}

/** Map sentinel / school-wide recipient to real PB general group id. */
export async function resolveAssignmentGroupIdForWrite(
  groupId: string,
  ownerTeacherId: string,
): Promise<string> {
  const trimmed = groupId.trim();
  if (!trimmed || trimmed === GENERAL_ASSIGNMENT_GROUP_ID) {
    const general = await ensureGeneralAssignmentGroup(ownerTeacherId);
    return general.id;
  }

  const pb = getPocketBase();
  try {
    const record = await pb.collection('assignment_groups').getOne(trimmed);
    const mapped = mapAssignmentGroupRecord(record);
    if (!isKindGeneralGroup(mapped) && mapped.name.trim() === GENERAL_ASSIGNMENT_GROUP_LABEL) {
      const promoted = await pb.collection('assignment_groups').update(trimmed, {
        kind: 'general',
        name: GENERAL_ASSIGNMENT_GROUP_LABEL,
      });
      return promoted.id;
    }
    return mapped.id;
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

      if (canManageAssignmentGroups(user)) {
        try {
          await ensureGeneralAssignmentGroup(requesterId);
        } catch {
          /* still list existing groups if ensure fails */
        }
      }

      const records = await pb.collection('assignment_groups').getFullList({ sort: 'name' });
      return records
        .map(mapAssignmentGroupRecord)
        .filter((group) => canViewAssignmentGroup(user, group));
    });
  },

  async getGroup(id, requesterId) {
    return withPbError(async () => {
      const user = await getRequesterUser(requesterId);
      const resolvedId =
        id === GENERAL_ASSIGNMENT_GROUP_ID
          ? (await ensureGeneralAssignmentGroup(requesterId)).id
          : id;
      const group = await loadGroupOrThrow(resolvedId);
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
