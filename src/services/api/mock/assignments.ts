import type { Assignment, AssignmentGroup, User } from '@/types';
import {
  canCreateAssignment,
  canManageAssignment,
  canViewAssignment,
} from '@/services/assignments/access';
import { MAX_CONTENT_BLOCKS_PER_ASSIGNMENT } from '@/services/assignments/constants';
import { sortAssignmentsByDate } from '@/services/assignments/helpers';
import { validateAssignmentContentFile, validateContentBlock } from '@/services/assignments/validation';
import { ApiError } from '@/services/api/types';
import type {
  AssignmentsApi,
  CreateAssignmentInput,
  UpdateAssignmentInput,
  UploadAssignmentFileInput,
} from '@/services/api/types';
import { isGeneralAssignmentGroup } from '@/services/assignments/groups/helpers';
import { createLocalUserResolver, toMockUserId, type MockUserResolver } from '@/services/api/mock/userResolver';
import { tryPushNotification, type MockNotificationsDb } from '@/services/api/mock/notifications';

export interface MockAssignmentsDb {
  assignments: Assignment[];
  assignmentGroups: AssignmentGroup[];
  users: User[];
  notifications: Array<{
    id: string;
    userId: string;
    type: string;
    title: string;
    body: string;
    read: boolean;
    createdAt: string;
    link?: string;
  }>;
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createMockAssignmentsApi(
  db: MockAssignmentsDb,
  delay: (ms?: number) => Promise<void>,
  resolveUser: MockUserResolver = createLocalUserResolver(db.users),
): AssignmentsApi {
  async function getUserById(userId: string): Promise<User> {
    return resolveUser(userId);
  }

  function getAssignmentById(id: string): Assignment {
    const assignment = db.assignments.find((a) => a.id === id);
    if (!assignment) throw new ApiError('Задание не найдено', 'NOT_FOUND', 404);
    return assignment;
  }

  async function assertViewAccess(assignment: Assignment, requesterId: string): Promise<User> {
    const user = await getUserById(requesterId);
    if (!canViewAssignment(user, assignment, db.assignmentGroups)) {
      throw new ApiError('Нет доступа к заданию', 'FORBIDDEN', 403);
    }
    return user;
  }

  function resolveNotifyMemberIds(group: AssignmentGroup): string[] {
    if (isGeneralAssignmentGroup(group)) {
      return db.users.filter((u) => u.role === 'student').map((u) => u.id);
    }
    return group.memberIds;
  }

  function pushGroupNotification(group: AssignmentGroup, title: string, body: string, link: string) {
    const notificationsDb = db as MockAssignmentsDb & MockNotificationsDb;
    for (const memberId of resolveNotifyMemberIds(group)) {
      // In-app record drives book badge + mark-as-viewed; inbox UI hides type=assignment.
      // Push delivery when user has subscription + pushEnabled.
      tryPushNotification(notificationsDb, memberId, 'assignment', title, body, link);
    }
  }

  return {
    async getAssignments(filters) {
      await delay();
      const user = await getUserById(filters.requesterId);
      let list = db.assignments.filter((a) => canViewAssignment(user, a, db.assignmentGroups));

      if (filters.groupId) {
        list = list.filter((a) => a.groupId === filters.groupId);
      }
      if (filters.teacherId) {
        list = list.filter((a) => a.teacherId === filters.teacherId);
      }

      return sortAssignmentsByDate(list);
    },

    async getAssignment(id, requesterId) {
      await delay();
      const assignment = getAssignmentById(id);
      await assertViewAccess(assignment, requesterId);
      return assignment;
    },

    async uploadAssignmentFile(input: UploadAssignmentFileInput, userId, contentType) {
      await delay(100);
      const user = await getUserById(userId);
      if (!canCreateAssignment(user)) {
        throw new ApiError('Нет прав на загрузку материалов', 'FORBIDDEN', 403);
      }

      const result = validateAssignmentContentFile(input, contentType);
      if (!result.valid) throw new ApiError(result.message, 'VALIDATION_ERROR', 400);

      return {
        url: input.dataUrl ?? `mock://assignments/${uid('file')}`,
        filename: input.filename,
        mimeType: input.mimeType,
      };
    },

    async createAssignment(input: CreateAssignmentInput, teacherId) {
      await delay(150);
      const teacher = await getUserById(teacherId);
      if (!canCreateAssignment(teacher)) {
        throw new ApiError('Нет прав на создание задания', 'FORBIDDEN', 403);
      }

      const group = db.assignmentGroups.find((g) => g.id === input.groupId);
      if (!group) throw new ApiError('Группа не найдена', 'NOT_FOUND', 404);

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

      const now = new Date().toISOString();
      const normalizedTeacherId = toMockUserId(db.users, teacher);
      const assignment: Assignment = {
        id: uid('asgn'),
        title: input.title.trim(),
        description: input.description.trim(),
        teacherId: normalizedTeacherId,
        groupId: input.groupId,
        dueDate: input.dueDate,
        contentBlocks: input.contentBlocks.map((block, index) => ({
          ...block,
          id: uid('blk'),
          order: block.order ?? index,
        })),
        createdAt: now,
        updatedAt: now,
      };

      db.assignments.push(assignment);

      pushGroupNotification(
        group,
        'Новое домашнее задание',
        assignment.title,
        `/assignments/${assignment.id}`,
      );

      return assignment;
    },

    async updateAssignment(id, input: UpdateAssignmentInput, requesterId) {
      await delay(150);
      const requester = await getUserById(requesterId);
      if (!canManageAssignment(requester)) {
        throw new ApiError('Нет прав на изменение задания', 'FORBIDDEN', 403);
      }

      const assignment = getAssignmentById(id);
      const group = db.assignmentGroups.find((g) => g.id === input.groupId);
      if (!group) throw new ApiError('Группа не найдена', 'NOT_FOUND', 404);

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

      const updated: Assignment = {
        ...assignment,
        title: input.title.trim(),
        description: input.description.trim(),
        groupId: input.groupId,
        dueDate: input.dueDate,
        contentBlocks: input.contentBlocks.map((block, index) => ({
          ...block,
          id: uid('blk'),
          order: block.order ?? index,
        })),
        updatedAt: new Date().toISOString(),
      };

      const idx = db.assignments.findIndex((a) => a.id === id);
      db.assignments[idx] = updated;
      return updated;
    },

    async deleteAssignment(id, requesterId) {
      await delay(100);
      const requester = await getUserById(requesterId);
      if (!canManageAssignment(requester)) {
        throw new ApiError('Нет прав на удаление задания', 'FORBIDDEN', 403);
      }
      getAssignmentById(id);
      db.assignments = db.assignments.filter((a) => a.id !== id);
    },
  };
}
