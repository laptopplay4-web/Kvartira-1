import { ClientResponseError } from 'pocketbase';
import type {
  AssignmentsApi,
  CreateAssignmentInput,
  ReviewAssignmentInput,
  SubmitAssignmentInput,
  UploadAssignmentFileInput,
} from '@/services/api/types';
import { ApiError } from '@/services/api/types';
import { getPocketBase } from '@/services/api/pocketbase/client';
import { withPbError } from '@/services/api/pocketbase/errors';
import { mapAssignmentRecord, mapUserRecord } from '@/services/api/pocketbase/mappers';
import { escapePbFilter } from '@/services/api/pocketbase/helpers';
import {
  collectStoredFileIds,
  linkStoredFilesToContext,
  resolveAssignment,
  uploadStoredFile,
} from '@/services/api/pocketbase/files';
import { can } from '@/permissions';
import {
  canCreateAssignment,
  canReviewAssignment,
  canSubmitAssignment,
  canViewAssignment,
} from '@/services/assignments/access';
import { MAX_MATERIALS_PER_ASSIGNMENT } from '@/services/assignments/constants';
import { sortAssignmentsByDueDate } from '@/services/assignments/helpers';
import {
  validateAssignmentFeedbackAudio,
  validateAssignmentMaterial,
  validateAssignmentResponseFile,
} from '@/services/assignments/validation';
import type { Assignment, AssignmentStatus, User } from '@/types';

function uid(prefix: string): string {
  const suffix = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return `${prefix}-${suffix}`;
}

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

async function loadAssignmentOrThrow(id: string): Promise<Assignment> {
  const pb = getPocketBase();
  try {
    const record = await pb.collection('assignments').getOne(id);
    return resolveAssignment(mapAssignmentRecord(record));
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      throw new ApiError('Задание не найдено', 'NOT_FOUND', 404);
    }
    throw error;
  }
}

async function assertViewAccess(id: string, requesterId: string): Promise<{ user: User; assignment: Assignment }> {
  const user = await getRequesterUser(requesterId);
  const assignment = await loadAssignmentOrThrow(id);
  if (!canViewAssignment(user, assignment)) {
    throw new ApiError('Нет доступа к заданию', 'FORBIDDEN', 403);
  }
  return { user, assignment };
}

function buildAssignmentsFilter(filters: {
  studentId?: string;
  teacherId?: string;
  status?: AssignmentStatus;
}): string {
  const parts: string[] = [];
  if (filters.studentId) parts.push(`student = "${escapePbFilter(filters.studentId)}"`);
  if (filters.teacherId) parts.push(`teacher = "${escapePbFilter(filters.teacherId)}"`);
  if (filters.status) parts.push(`status = "${escapePbFilter(filters.status)}"`);
  return parts.join(' && ');
}

export const pocketbaseAssignmentsApi: AssignmentsApi = {
  async getAssignments(filters) {
    return withPbError(async () => {
      const user = await getRequesterUser(filters.requesterId);
      const pb = getPocketBase();
      const filter = buildAssignmentsFilter(filters);
      const records = await pb.collection('assignments').getFullList({
        filter: filter || undefined,
        sort: 'dueDate',
      });
      const list = records
        .map(mapAssignmentRecord)
        .filter((assignment) => canViewAssignment(user, assignment));
      const resolved = await Promise.all(list.map(resolveAssignment));
      return sortAssignmentsByDueDate(resolved);
    });
  },

  async getAssignment(id, requesterId) {
    return withPbError(async () => {
      const { assignment } = await assertViewAccess(id, requesterId);
      return assignment;
    });
  },

  async uploadAssignmentFile(input: UploadAssignmentFileInput, userId, purpose, responseType) {
    return withPbError(async () => {
      const user = await getRequesterUser(userId);

      if (purpose === 'material') {
        if (!canCreateAssignment(user)) {
          throw new ApiError('Нет прав на загрузку материалов', 'FORBIDDEN', 403);
        }
        const result = validateAssignmentMaterial(input);
        if (!result.valid) throw new ApiError(result.message, 'VALIDATION_ERROR', 400);
      } else if (purpose === 'feedback') {
        if (!can(user, 'assignments:review')) {
          throw new ApiError('Нет прав на загрузку аудиокомментария', 'FORBIDDEN', 403);
        }
        const result = validateAssignmentFeedbackAudio(input);
        if (!result.valid) throw new ApiError(result.message, 'VALIDATION_ERROR', 400);
      } else {
        if (!can(user, 'assignments:submit')) {
          throw new ApiError('Нет прав на загрузку ответа', 'FORBIDDEN', 403);
        }
        if (!responseType) {
          throw new ApiError('Укажите тип ответа', 'VALIDATION_ERROR', 400);
        }
        const result = validateAssignmentResponseFile(input, responseType);
        if (!result.valid) throw new ApiError(result.message, 'VALIDATION_ERROR', 400);
      }

      if (!input.dataUrl) {
        throw new ApiError('Файл не передан', 'VALIDATION_ERROR', 400);
      }

      const stored = await uploadStoredFile({
        userId,
        purpose: 'assignment',
        filename: input.filename,
        mimeType: input.mimeType,
        size: input.size,
        dataUrl: input.dataUrl,
      });

      return {
        filename: stored.filename,
        mimeType: stored.mimeType,
        url: stored.url,
      };
    });
  },

  async createAssignment(input: CreateAssignmentInput, teacherId) {
    return withPbError(async () => {
      const teacher = await getRequesterUser(teacherId);
      if (!canCreateAssignment(teacher)) {
        throw new ApiError('Нет прав на создание задания', 'FORBIDDEN', 403);
      }

      const student = await getRequesterUser(input.studentId);
      if (student.role !== 'student') {
        throw new ApiError('Задание можно назначить только ученику', 'VALIDATION_ERROR', 400);
      }

      if (!input.title.trim() || !input.description.trim()) {
        throw new ApiError('Заполните название и описание', 'VALIDATION_ERROR', 400);
      }

      const materials = input.materials ?? [];
      if (materials.length > MAX_MATERIALS_PER_ASSIGNMENT) {
        throw new ApiError(
          `Максимум ${MAX_MATERIALS_PER_ASSIGNMENT} материалов`,
          'VALIDATION_ERROR',
          400,
        );
      }

      const pb = getPocketBase();
      const record = await pb.collection('assignments').create({
        title: input.title.trim(),
        description: input.description.trim(),
        teacher: teacherId,
        student: input.studentId,
        lesson: input.lessonId ?? '',
        dueDate: input.dueDate,
        responseType: input.responseType,
        status: 'assigned',
        materials: materials.map((m) => ({ ...m, id: uid('mat') })),
        submission: null,
        feedback: null,
      });

      await linkStoredFilesToContext(
        collectStoredFileIds(...materials.map((material) => material.url)),
        record.id,
      );

      return resolveAssignment(mapAssignmentRecord(record));
    });
  },

  async submitAssignment(id, input: SubmitAssignmentInput, studentId) {
    return withPbError(async () => {
      const { user: student, assignment } = await assertViewAccess(id, studentId);

      if (!canSubmitAssignment(student, assignment)) {
        throw new ApiError('Нельзя отправить ответ на это задание', 'FORBIDDEN', 403);
      }

      const hasText = !!input.text?.trim();
      const hasFile = !!input.attachmentUrl;

      if (assignment.responseType === 'text') {
        if (!hasText) {
          throw new ApiError('Добавьте текст ответа', 'VALIDATION_ERROR', 400);
        }
      } else if (!hasFile) {
        throw new ApiError('Загрузите файл ответа', 'VALIDATION_ERROR', 400);
      } else if (hasFile && input.attachmentFilename && input.attachmentMimeType) {
        const result = validateAssignmentResponseFile(
          {
            filename: input.attachmentFilename,
            mimeType: input.attachmentMimeType,
            size: 1,
          },
          assignment.responseType,
        );
        if (!result.valid) throw new ApiError(result.message, 'VALIDATION_ERROR', 400);
      }

      const now = new Date().toISOString();
      const pb = getPocketBase();
      const record = await pb.collection('assignments').update(id, {
        submission: {
          text: input.text?.trim(),
          attachmentUrl: input.attachmentUrl,
          attachmentFilename: input.attachmentFilename,
          attachmentMimeType: input.attachmentMimeType,
          submittedAt: now,
        },
        status: 'submitted',
      });

      await linkStoredFilesToContext(collectStoredFileIds(input.attachmentUrl), id);

      return resolveAssignment(mapAssignmentRecord(record));
    });
  },

  async reviewAssignment(id, input: ReviewAssignmentInput, teacherId) {
    return withPbError(async () => {
      const { user: teacher, assignment } = await assertViewAccess(id, teacherId);

      if (!canReviewAssignment(teacher, assignment)) {
        throw new ApiError('Нельзя проверить это задание', 'FORBIDDEN', 403);
      }

      const hasText = !!input.text?.trim();
      const hasAudio = !!input.audioUrl;

      if (!hasText && !hasAudio) {
        throw new ApiError('Добавьте комментарий или аудио', 'VALIDATION_ERROR', 400);
      }

      if (hasAudio && input.audioFilename && input.audioMimeType) {
        const result = validateAssignmentFeedbackAudio({
          filename: input.audioFilename,
          mimeType: input.audioMimeType,
          size: 1,
        });
        if (!result.valid) throw new ApiError(result.message, 'VALIDATION_ERROR', 400);
      }

      const now = new Date().toISOString();
      const pb = getPocketBase();
      const record = await pb.collection('assignments').update(id, {
        feedback: {
          text: input.text?.trim() || undefined,
          rating: input.rating,
          audioUrl: input.audioUrl,
          audioFilename: input.audioFilename,
          audioMimeType: input.audioMimeType,
          createdAt: now,
        },
        status: 'reviewed',
      });

      await linkStoredFilesToContext(collectStoredFileIds(input.audioUrl), id);

      return resolveAssignment(mapAssignmentRecord(record));
    });
  },
};
