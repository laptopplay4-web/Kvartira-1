import { ClientResponseError } from 'pocketbase';
import type { Assignment, AssignmentContentType, User } from '@/types';
import { ApiError } from '@/services/api/types';
import type {
  AssignmentsApi,
  CreateAssignmentInput,
  UpdateAssignmentInput,
  UploadAssignmentFileInput,
} from '@/services/api/types';
import { getPocketBase } from '@/services/api/pocketbase/client';
import { withPbError } from '@/services/api/pocketbase/errors';
import {
  mapAssignmentRecord,
  mapUserRecord,
} from '@/services/api/pocketbase/mappers';
import {
  collectStoredFileIds,
  linkStoredFilesToContext,
  resolveAssignment,
  uploadStoredFile,
} from '@/services/api/pocketbase/files';
import { resolveAssignmentGroupIdForWrite } from '@/services/api/pocketbase/groups';
import {
  canCreateAssignment,
  canManageAssignment,
} from '@/services/assignments/access';
import { MAX_CONTENT_BLOCKS_PER_ASSIGNMENT } from '@/services/assignments/constants';
import { sortAssignmentsByDate } from '@/services/assignments/helpers';
import { validateAssignmentContentFile, validateContentBlock } from '@/services/assignments/validation';

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

export const pocketbaseAssignmentsApi: AssignmentsApi = {
  async getAssignments(filters) {
    return withPbError(async () => {
      const pb = getPocketBase();
      // Trust PocketBase list rules. Client canView + incomplete group list hid school-wide ДЗ.
      const records = await pb.collection('assignments').getFullList({ sort: '-id' });

      let list = records.map(mapAssignmentRecord);

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

  async getAssignment(id, _requesterId) {
    return withPbError(async () => {
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

      return resolveAssignment(mapAssignmentRecord(record));
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
      const groupId = await resolveAssignmentGroupIdForWrite(input.groupId, teacherId);

      const contentBlocks = input.contentBlocks.map((block, index) => ({
        ...block,
        id: `blk-${Date.now()}-${index}`,
        order: block.order ?? index,
      }));

      const record = await pb.collection('assignments').create({
        title: input.title.trim(),
        description: input.description.trim(),
        teacher: teacherId,
        group: groupId,
        dueDate: input.dueDate || '',
        contentBlocks,
      });

      const assignment = mapAssignmentRecord(record);
      const fileIds = collectStoredFileIds(...contentBlocks.map((b) => b.url));
      await linkStoredFilesToContext(fileIds, assignment.id);
      // Push + unread badge: PB hook onRecordAfterCreateSuccess → notifications → push relay.

      return resolveAssignment(assignment);
    });
  },

  async updateAssignment(
    id: string,
    input: UpdateAssignmentInput,
    requesterId: string,
  ): Promise<Assignment> {
    const requester = await getRequesterUser(requesterId);
    if (!canManageAssignment(requester)) {
      throw new ApiError('Нет прав на изменение задания', 'FORBIDDEN', 403);
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
      const groupId = await resolveAssignmentGroupIdForWrite(input.groupId, requesterId);

      let existing;
      try {
        existing = await pb.collection('assignments').getOne(id);
      } catch (error) {
        if (error instanceof ClientResponseError && error.status === 404) {
          throw new ApiError('Задание не найдено', 'NOT_FOUND', 404);
        }
        throw error;
      }

      const existingAssignment = mapAssignmentRecord(existing);
      const contentBlocks = input.contentBlocks.map((block, index) => ({
        ...block,
        id: `blk-${Date.now()}-${index}`,
        order: block.order ?? index,
      }));

      const record = await pb.collection('assignments').update(id, {
        title: input.title.trim(),
        description: input.description.trim(),
        group: groupId,
        dueDate: input.dueDate || '',
        contentBlocks,
        // SDK RecordModel — поля объекта, не .get() (это API JSVM-хуков).
        teacher: existingAssignment.teacherId,
      });

      const assignment = mapAssignmentRecord(record);
      const fileIds = collectStoredFileIds(...contentBlocks.map((b) => b.url));
      await linkStoredFilesToContext(fileIds, assignment.id);
      return resolveAssignment(assignment);
    });
  },

  async deleteAssignment(id: string, requesterId: string): Promise<void> {
    const requester = await getRequesterUser(requesterId);
    if (!canManageAssignment(requester)) {
      throw new ApiError('Нет прав на удаление задания', 'FORBIDDEN', 403);
    }

    return withPbError(async () => {
      const pb = getPocketBase();
      try {
        await pb.collection('assignments').delete(id);
      } catch (error) {
        if (error instanceof ClientResponseError && error.status === 404) {
          throw new ApiError('Задание не найдено', 'NOT_FOUND', 404);
        }
        throw error;
      }
    });
  },
};
