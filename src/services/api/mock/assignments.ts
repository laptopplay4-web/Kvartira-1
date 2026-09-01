import type { Assignment, User } from '@/types';
import { canCreateAssignment, canReviewAssignment, canSubmitAssignment, canViewAssignment } from '@/services/assignments/access';
import { can } from '@/permissions';
import { MAX_MATERIALS_PER_ASSIGNMENT } from '@/services/assignments/constants';
import { sortAssignmentsByDueDate } from '@/services/assignments/helpers';
import {
  validateAssignmentMaterial,
  validateAssignmentResponseFile,
  validateAssignmentFeedbackAudio,
} from '@/services/assignments/validation';
import { evaluateAndUnlockAchievements, type AchievementEvaluationData } from '@/services/progress/achievements';
import { ApiError } from '@/services/api/types';
import type {
  AssignmentsApi,
  CreateAssignmentInput,
  ReviewAssignmentInput,
  SubmitAssignmentInput,
  UploadAssignmentFileInput,
} from '@/services/api/types';

export interface MockAssignmentsDb extends AchievementEvaluationData {
  users: User[];
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createMockAssignmentsApi(
  db: MockAssignmentsDb,
  delay: (ms?: number) => Promise<void>,
): AssignmentsApi {
  function getUserById(userId: string): User {
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new ApiError('Пользователь не найден', 'NOT_FOUND', 404);
    return user;
  }

  function getAssignmentById(id: string): Assignment {
    const assignment = db.assignments.find((a) => a.id === id);
    if (!assignment) throw new ApiError('Задание не найдено', 'NOT_FOUND', 404);
    return assignment;
  }

  function assertViewAccess(assignment: Assignment, requesterId: string): User {
    const user = getUserById(requesterId);
    if (!canViewAssignment(user, assignment)) {
      throw new ApiError('Нет доступа к заданию', 'FORBIDDEN', 403);
    }
    return user;
  }

  function pushAssignmentNotification(userId: string, title: string, body: string, link: string) {
    db.notifications.push({
      id: uid('notif'),
      userId,
      type: 'assignment',
      title,
      body,
      read: false,
      createdAt: new Date().toISOString(),
      link,
    });
  }

  return {
    async getAssignments(filters) {
      await delay();
      const user = getUserById(filters.requesterId);
      let list = db.assignments.filter((a) => canViewAssignment(user, a));

      if (filters.studentId) {
        list = list.filter((a) => a.studentId === filters.studentId);
      }
      if (filters.teacherId) {
        list = list.filter((a) => a.teacherId === filters.teacherId);
      }
      if (filters.status) {
        list = list.filter((a) => a.status === filters.status);
      }

      return sortAssignmentsByDueDate(list);
    },

    async getAssignment(id, requesterId) {
      await delay();
      const assignment = getAssignmentById(id);
      assertViewAccess(assignment, requesterId);
      return assignment;
    },

    async uploadAssignmentFile(input: UploadAssignmentFileInput, userId, purpose, responseType) {
      await delay(100);
      const user = getUserById(userId);

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

      return {
        filename: input.filename,
        mimeType: input.mimeType,
        url: input.dataUrl ?? `mock://assignments/${uid('file')}`,
      };
    },

    async createAssignment(input: CreateAssignmentInput, teacherId) {
      await delay(150);
      const teacher = getUserById(teacherId);
      if (!canCreateAssignment(teacher)) {
        throw new ApiError('Нет прав на создание задания', 'FORBIDDEN', 403);
      }

      const student = getUserById(input.studentId);
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

      const now = new Date().toISOString();
      const assignment: Assignment = {
        id: uid('asgn'),
        title: input.title.trim(),
        description: input.description.trim(),
        teacherId,
        studentId: input.studentId,
        lessonId: input.lessonId,
        dueDate: input.dueDate,
        responseType: input.responseType,
        status: 'assigned',
        materials: materials.map((m) => ({ ...m, id: uid('mat') })),
        createdAt: now,
        updatedAt: now,
      };

      db.assignments.push(assignment);

      pushAssignmentNotification(
        input.studentId,
        'Новое домашнее задание',
        assignment.title,
        `/assignments/${assignment.id}`,
      );

      return assignment;
    },

    async submitAssignment(id, input: SubmitAssignmentInput, studentId) {
      await delay(150);
      const assignment = getAssignmentById(id);
      const student = getUserById(studentId);
      assertViewAccess(assignment, studentId);

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
      assignment.submission = {
        text: input.text?.trim(),
        attachmentUrl: input.attachmentUrl,
        attachmentFilename: input.attachmentFilename,
        attachmentMimeType: input.attachmentMimeType,
        submittedAt: now,
      };
      assignment.status = 'submitted';
      assignment.updatedAt = now;
      return assignment;
    },

    async reviewAssignment(id, input: ReviewAssignmentInput, teacherId) {
      await delay(150);
      const assignment = getAssignmentById(id);
      const teacher = getUserById(teacherId);
      assertViewAccess(assignment, teacherId);

      if (!canReviewAssignment(teacher, assignment)) {
        throw new ApiError('Нельзя проверить это задание', 'FORBIDDEN', 403);
      }

      const hasText = !!input.text?.trim();
      const hasAudio = !!input.audioUrl;

      if (!hasText && !hasAudio) {
        throw new ApiError('Добавьте комментарий или аудио', 'VALIDATION_ERROR', 400);
      }

      if (
        hasAudio &&
        input.audioFilename &&
        input.audioMimeType
      ) {
        const result = validateAssignmentFeedbackAudio({
          filename: input.audioFilename,
          mimeType: input.audioMimeType,
          size: 1,
        });
        if (!result.valid) throw new ApiError(result.message, 'VALIDATION_ERROR', 400);
      }

      const now = new Date().toISOString();
      assignment.feedback = {
        text: input.text?.trim() || undefined,
        rating: input.rating,
        audioUrl: input.audioUrl,
        audioFilename: input.audioFilename,
        audioMimeType: input.audioMimeType,
        createdAt: now,
      };
      assignment.status = 'reviewed';
      assignment.updatedAt = now;
      evaluateAndUnlockAchievements(db, assignment.studentId, uid);
      return assignment;
    },
  };
}
