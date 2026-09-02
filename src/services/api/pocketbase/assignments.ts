import { ClientResponseError } from 'pocketbase';
import type { Assignment, AssignmentContentType, User } from '@/types';
import { ApiError } from '@/services/api/types';
import type { AssignmentsApi, CreateAssignmentInput, UploadAssignmentFileInput } from '@/services/api/types';
import { getPocketBase } from '@/services/api/pocketbase/client';
import { mapPocketBaseError, withPbError } from '@/services/api/pocketbase/errors';
import {
  mapAssignmentGroupRecord,
  mapAssignmentRecord,
  mapUserRecord,
} from '@/services/api/pocketbase/mappers';
import {
  collectStoredFileIds,
  linkStoredFilesToContext,
  resolveAssignment,
  uploadStoredFile,
} from '@/services/api/pocketbase/files';
import { canCreateAssignment, canViewAssignment } from '@/services/assignments/access';
import { MAX_CONTENT_BLOCKS_PER_ASSIGNMENT } from '@/services/assignments/constants';
import { sortAssignmentsByDate } from '@/services/assignments/helpers';
import { validateAssignmentContentFile, validateContentBlock } from '@/services/assignments/validation';
import { isGeneralAssignmentGroup } from '@/services/assignments/groups/helpers';

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

async function loadGroups() {
  const pb = getPocketBase();
  const records = await pb.collection('assignment_groups').getFullList({ sort: 'name' });
  return records.map(mapAssignmentGroupRecord);
}

async function notifyGroupMembers(groupId: string, title: string, body: string, link: string) {
  const pb = getPocketBase();
  try {
    const groupRecord = await pb.collection('assignment_groups').getOne(groupId);
    const group = mapAssignmentGroupRecord(groupRecord);
    let memberIds = group.memberIds;

    if (isGeneralAssignmentGroup(group)) {
      const students = await pb.collection('users').getFullList({ filter: 'role = "student"' });
      memberIds = students.map((s) => s.id);
    }

    await Promise.all(
      memberIds.map((userId) =>
        pb
          .collection('notifications')
          .create({
            user: userId,
            type: 'assignment',
            title,
            body,
            read: false,
            link,
          })
          .catch((error) => {
            const mapped = mapPocketBaseError(error);
            if (mapped.code !== 'FORBIDDEN') throw error;
          }),
      ),
    );
  } catch {
    /* notification is best-effort */
  }
}

export const pocketbaseAssignmentsApi: AssignmentsApi = {
  async getAssignments(filters) {
    return withPbError(async () => {
      const user = await getRequesterUser(filters.requesterId);
      const pb = getPocketBase();
      const [groups, records] = await Promise.all([
        loadGroups(),
        pb.collection('assignments').getFullList({ sort: '-id' }),
      ]);

      let list = records
        .map(mapAssignmentRecord)
        .filter((assignment) => canViewAssignment(user, assignment, groups));

      if (filters.groupId) {
        list = list.filter((a) => a.groupId === filters.groupId);
      }
      if (filters.teacherId) {
        list = list.filter((a) => a.teacherId === filters.teacherId);
      }

      const resolved = await Promise.all(list.map(resolveAssignment));
      return sortAssignmentsByDate(resolved);
    });
  },

  async getAssignment(id, requesterId) {
    return withPbError(async () => {
      const user = await getRequesterUser(requesterId);
      const pb = getPocketBase();
      let record;
      try {
        record = await pb.collection('assignments').getOne(id);
      } catch (error) {
        if (error instanceof ClientResponseError && error.status === 404) {
          throw new ApiError('Задание не найдено', 'NOT_FOUND', 404);
        }
        throw error;
      }

      const assignment = mapAssignmentRecord(record);
      const groups = await loadGroups();
      if (!canViewAssignment(user, assignment, groups)) {
        throw new ApiError('Нет доступа к заданию', 'FORBIDDEN', 403);
      }
      return resolveAssignment(assignment);
    });
  },

  async uploadAssignmentFile(
    input: UploadAssignmentFileInput,
    userId: string,
    contentType: AssignmentContentType,
  ) {
    const user = await getRequesterUser(userId);
    if (!canCreateAssignment(user)) {
      throw new ApiError('Нет прав на загрузку материалов', 'FORBIDDEN', 403);
    }

    const result = validateAssignmentContentFile(input, contentType);
    if (!result.valid) throw new ApiError(result.message, 'VALIDATION_ERROR', 400);
    if (!input.dataUrl) {
      throw new ApiError('Файл не передан', 'VALIDATION_ERROR', 400);
    }

    return withPbError(async () => {
      const uploaded = await uploadStoredFile({
        userId,
        purpose: 'assignment',
        filename: input.filename,
        mimeType: input.mimeType,
        size: input.size,
        dataUrl: input.dataUrl!,
      });
      return {
        url: uploaded.url,
        filename: uploaded.filename,
        mimeType: uploaded.mimeType,
      };
    });
  },

  async createAssignment(input: CreateAssignmentInput, teacherId: string): Promise<Assignment> {
    const teacher = await getRequesterUser(teacherId);
    if (!canCreateAssignment(teacher)) {
      throw new ApiError('Нет прав на создание задания', 'FORBIDDEN', 403);
    }
    if (!input.title.trim() || !input.description.trim()) {
      throw new ApiError('Заполните название и описание', 'VALIDATION_ERROR', 400);
    }
    if (!input.contentBlocks.length) {
      throw new ApiError('Добавьте хотя бы один блок материала', 'VALIDATION_ERROR', 400);
    }
    if (input.contentBlocks.length > MAX_CONTENT_BLOCKS_PER_ASSIGNMENT) {
      throw new ApiError(
        `Максимум ${MAX_CONTENT_BLOCKS_PER_ASSIGNMENT} блоков`,
        'VALIDATION_ERROR',
        400,
      );
    }

    for (const block of input.contentBlocks) {
      const validation = validateContentBlock(
        block.type,
        block.text,
        block.url
          ? { filename: block.filename ?? 'file', mimeType: block.mimeType ?? '', size: 1 }
          : undefined,
      );
      if (!validation.valid) throw new ApiError(validation.message, 'VALIDATION_ERROR', 400);
    }

    return withPbError(async () => {
      const pb = getPocketBase();
      try {
        await pb.collection('assignment_groups').getOne(input.groupId);
      } catch (error) {
        if (error instanceof ClientResponseError && error.status === 404) {
          throw new ApiError('Группа не найдена', 'NOT_FOUND', 404);
        }
        throw error;
      }

      const contentBlocks = input.contentBlocks.map((block, index) => ({
        ...block,
        id: `blk-${Date.now()}-${index}`,
        order: block.order ?? index,
      }));

      const record = await pb.collection('assignments').create({
        title: input.title.trim(),
        description: input.description.trim(),
        teacher: teacherId,
        group: input.groupId,
        dueDate: input.dueDate || '',
        contentBlocks,
      });

      const assignment = mapAssignmentRecord(record);
      const fileIds = collectStoredFileIds(...contentBlocks.map((b) => b.url));
      await linkStoredFilesToContext(fileIds, assignment.id);
      await notifyGroupMembers(
        input.groupId,
        'Новое домашнее задание',
        assignment.title,
        `/assignments/${assignment.id}`,
      );

      return resolveAssignment(assignment);
    });
  },
};
