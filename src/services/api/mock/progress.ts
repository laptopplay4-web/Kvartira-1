import type {
  ProgressGoal,
  Skill,
  StudentSkillProgress,
  User,
} from '@/types';
import { canViewStudentProgress, canManageStudentGoals, canManageStudentSkills } from '@/services/progress/access';
import {
  buildAchievementsWithStatus,
  buildSkillsWithProgress,
  computeProgressSummary,
  getAssignedStudentIds,
} from '@/services/progress/helpers';
import { validateGoalTitle, validateSkillLevel } from '@/services/progress/validation';
import { can } from '@/permissions';
import { evaluateAndUnlockAchievements, type AchievementEvaluationData } from '@/services/progress/achievements';
import { ApiError } from '@/services/api/types';
import type {
  CreateProgressGoalInput,
  ProgressApi,
  UpdateProgressGoalInput,
  UpdateSkillProgressInput,
} from '@/services/api/types';

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export interface MockProgressDb extends AchievementEvaluationData {
  users: User[];
  skills: Skill[];
  progressGoals: ProgressGoal[];
}

export function createMockProgressApi(
  db: MockProgressDb,
  delay: (ms?: number) => Promise<void>,
): ProgressApi {
  function getUserById(userId: string): User {
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new ApiError('Пользователь не найден', 'NOT_FOUND', 404);
    return user;
  }

  function getAssignedIdsForRequester(requester: User): string[] {
    if (can(requester, 'progress:view-all')) {
      return db.users.filter((u) => u.role === 'student').map((u) => u.id);
    }
    if (can(requester, 'progress:view-assigned')) {
      return getAssignedStudentIds(db.lessons, requester.id);
    }
    if (can(requester, 'progress:view-own')) {
      return [requester.id];
    }
    return [];
  }

  function assertViewAccess(studentId: string, requesterId: string): User {
    const requester = getUserById(requesterId);
    const assignedIds = getAssignedIdsForRequester(requester);
    if (!canViewStudentProgress(requester, studentId, assignedIds)) {
      throw new ApiError('Нет доступа к прогрессу ученика', 'FORBIDDEN', 403);
    }
    return requester;
  }

  function assertManageGoalsAccess(studentId: string, requesterId: string): User {
    const requester = getUserById(requesterId);
    const assignedIds = getAssignedIdsForRequester(requester);
    if (!canManageStudentGoals(requester, studentId, assignedIds)) {
      throw new ApiError('Нет прав на управление целями', 'FORBIDDEN', 403);
    }
    return requester;
  }

  function assertManageSkillsAccess(studentId: string, requesterId: string): User {
    const requester = getUserById(requesterId);
    const assignedIds = getAssignedIdsForRequester(requester);
    if (!canManageStudentSkills(requester, studentId, assignedIds)) {
      throw new ApiError('Нет прав на управление навыками', 'FORBIDDEN', 403);
    }
    return requester;
  }

  function getGoalById(goalId: string): ProgressGoal {
    const goal = db.progressGoals.find((g) => g.id === goalId);
    if (!goal) throw new ApiError('Цель не найдена', 'NOT_FOUND', 404);
    return goal;
  }

  return {
    async getAccessibleStudentIds(requesterId) {
      await delay();
      const requester = getUserById(requesterId);
      return getAssignedIdsForRequester(requester);
    },

    async getSummary(studentId, requesterId) {
      await delay();
      assertViewAccess(studentId, requesterId);
      evaluateAndUnlockAchievements(db, studentId, uid);
      return computeProgressSummary({
        studentId,
        lessons: db.lessons,
        assignments: db.assignments,
        goals: db.progressGoals,
        skillProgress: db.skillProgress,
        achievements: db.achievementDefinitions,
        userAchievements: db.userAchievements,
      });
    },

    async getSkills(studentId, requesterId) {
      await delay();
      assertViewAccess(studentId, requesterId);
      return buildSkillsWithProgress(db.skills, db.skillProgress, studentId);
    },

    async getGoals(studentId, requesterId) {
      await delay();
      assertViewAccess(studentId, requesterId);
      return db.progressGoals
        .filter((g) => g.studentId === studentId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async getHistory(studentId, requesterId, limit = 20) {
      await delay();
      assertViewAccess(studentId, requesterId);
      return db.progressHistory
        .filter((h) => h.studentId === studentId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
    },

    async getAchievements(studentId, requesterId) {
      await delay();
      assertViewAccess(studentId, requesterId);
      evaluateAndUnlockAchievements(db, studentId, uid);
      return buildAchievementsWithStatus(db.achievementDefinitions, db.userAchievements, studentId);
    },

    async createGoal(input: CreateProgressGoalInput, requesterId) {
      await delay(150);
      const requester = assertManageGoalsAccess(input.studentId, requesterId);
      const titleCheck = validateGoalTitle(input.title);
      if (!titleCheck.valid) throw new ApiError(titleCheck.message!, 'VALIDATION_ERROR', 400);

      const now = new Date().toISOString();
      const goal: ProgressGoal = {
        id: uid('goal'),
        studentId: input.studentId,
        teacherId: requester.role === 'teacher' ? requester.id : undefined,
        title: input.title.trim(),
        description: input.description?.trim() || undefined,
        targetDate: input.targetDate || undefined,
        status: 'active',
        createdAt: now,
      };
      db.progressGoals.push(goal);
      db.progressHistory.push({
        id: uid('hist-prog'),
        studentId: input.studentId,
        type: 'goal',
        title: `Новая цель: ${goal.title}`,
        createdAt: now,
      });
      return goal;
    },

    async updateGoal(goalId, input: UpdateProgressGoalInput, requesterId) {
      await delay(150);
      const goal = getGoalById(goalId);
      assertManageGoalsAccess(goal.studentId, requesterId);

      if (input.title !== undefined) {
        const titleCheck = validateGoalTitle(input.title);
        if (!titleCheck.valid) throw new ApiError(titleCheck.message!, 'VALIDATION_ERROR', 400);
        goal.title = input.title.trim();
      }
      if (input.description !== undefined) {
        goal.description = input.description.trim() || undefined;
      }
      if (input.targetDate !== undefined) {
        goal.targetDate = input.targetDate || undefined;
      }
      if (input.status !== undefined) {
        goal.status = input.status;
        if (input.status === 'completed') {
          goal.completedAt = new Date().toISOString();
          db.progressHistory.push({
            id: uid('hist-prog'),
            studentId: goal.studentId,
            type: 'goal',
            title: `Цель выполнена: ${goal.title}`,
            createdAt: goal.completedAt,
          });
        }
      }
      return goal;
    },

    async updateSkillProgress(input: UpdateSkillProgressInput, requesterId) {
      await delay(150);
      assertManageSkillsAccess(input.studentId, requesterId);
      const skill = db.skills.find((s) => s.id === input.skillId);
      if (!skill) throw new ApiError('Навык не найден', 'NOT_FOUND', 404);

      const levelCheck = validateSkillLevel(input.level, skill.maxLevel);
      if (!levelCheck.valid) throw new ApiError(levelCheck.message!, 'VALIDATION_ERROR', 400);

      const now = new Date().toISOString();
      const existing = db.skillProgress.find(
        (p) => p.studentId === input.studentId && p.skillId === input.skillId,
      );

      let record: StudentSkillProgress;
      if (existing) {
        existing.level = input.level;
        existing.note = input.note?.trim() || undefined;
        existing.updatedAt = now;
        record = existing;
      } else {
        record = {
          id: uid('prog'),
          studentId: input.studentId,
          skillId: input.skillId,
          level: input.level,
          note: input.note?.trim() || undefined,
          updatedAt: now,
        };
        db.skillProgress.push(record);
      }

      db.progressHistory.push({
        id: uid('hist-prog'),
        studentId: input.studentId,
        type: 'skill',
        title: `Прогресс: ${skill.name}`,
        description: `Уровень: ${input.level}%`,
        createdAt: now,
      });

      evaluateAndUnlockAchievements(db, input.studentId, uid);
      return record;
    },
  };
}
