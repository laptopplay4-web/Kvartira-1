import { ClientResponseError } from 'pocketbase';
import type {
  CreateProgressGoalInput,
  ProgressApi,
  UpdateProgressGoalInput,
  UpdateSkillProgressInput,
} from '@/services/api/types';
import { ApiError } from '@/services/api/types';
import { getPocketBase } from '@/services/api/pocketbase/client';
import { mapPocketBaseError, withPbError } from '@/services/api/pocketbase/errors';
import {
  mapAchievementDefinitionRecord,
  mapAssignmentRecord,
  mapEventRecord,
  mapLessonRecord,
  mapProgressGoalRecord,
  mapProgressHistoryRecord,
  mapSkillProgressRecord,
  mapSkillRecord,
  mapUserAchievementRecord,
  mapUserRecord,
} from '@/services/api/pocketbase/mappers';
import { escapePbFilter } from '@/services/api/pocketbase/helpers';
import { can } from '@/permissions';
import {
  canManageStudentGoals,
  canManageStudentSkills,
  canViewStudentProgress,
} from '@/services/progress/access';
import {
  evaluateAndUnlockAchievements,
  type AchievementEvaluationData,
} from '@/services/progress/achievements';
import {
  buildAchievementsWithStatus,
  buildSkillsWithProgress,
  computeProgressSummary,
  getAssignedStudentIds,
} from '@/services/progress/helpers';
import { toPbSkillLevel } from '@/services/progress/skillLevel';
import { validateGoalTitle, validateSkillLevel } from '@/services/progress/validation';
import type { ProgressHistoryEntry, User } from '@/types';

function uid(prefix: string): string {
  const suffix = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return `${prefix}-${suffix}`;
}

function studentFilter(studentId: string): string {
  return `student = "${escapePbFilter(studentId)}"`;
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

async function getAssignedIdsForRequester(requester: User): Promise<string[]> {
  const pb = getPocketBase();

  if (can(requester, 'progress:view-all')) {
    const records = await pb.collection('users').getFullList({ filter: 'role = "student"' });
    return records.map((record) => record.id);
  }

  if (can(requester, 'progress:view-assigned')) {
    const records = await pb.collection('lessons').getFullList({
      filter: `teacher = "${escapePbFilter(requester.id)}"`,
    });
    return getAssignedStudentIds(records.map(mapLessonRecord), requester.id);
  }

  if (can(requester, 'progress:view-own')) {
    return [requester.id];
  }

  return [];
}

async function assertViewAccess(studentId: string, requesterId: string): Promise<User> {
  const requester = await getRequesterUser(requesterId);
  const assignedIds = await getAssignedIdsForRequester(requester);
  if (!canViewStudentProgress(requester, studentId, assignedIds)) {
    throw new ApiError('Нет доступа к прогрессу ученика', 'FORBIDDEN', 403);
  }
  return requester;
}

async function assertManageGoalsAccess(studentId: string, requesterId: string): Promise<User> {
  const requester = await getRequesterUser(requesterId);
  const assignedIds = await getAssignedIdsForRequester(requester);
  if (!canManageStudentGoals(requester, studentId, assignedIds)) {
    throw new ApiError('Нет прав на управление целями', 'FORBIDDEN', 403);
  }
  return requester;
}

async function assertManageSkillsAccess(studentId: string, requesterId: string): Promise<User> {
  const requester = await getRequesterUser(requesterId);
  const assignedIds = await getAssignedIdsForRequester(requester);
  if (!canManageStudentSkills(requester, studentId, assignedIds)) {
    throw new ApiError('Нет прав на управление навыками', 'FORBIDDEN', 403);
  }
  return requester;
}

async function loadEvaluationData(studentId: string): Promise<AchievementEvaluationData> {
  const pb = getPocketBase();
  const filter = studentFilter(studentId);

  const [lessons, assignments, skillProgress, events, definitions, userAchievements, progressHistory] =
    await Promise.all([
      pb.collection('lessons').getFullList({ filter }),
      pb.collection('assignments').getFullList({ filter }),
      pb.collection('student_skill_progress').getFullList({ filter }),
      pb.collection('events').getFullList(),
      pb.collection('achievement_definitions').getFullList(),
      pb.collection('user_achievements').getFullList({ filter }),
      pb.collection('progress_history').getFullList({ filter, sort: '-id' }),
    ]);

  return {
    lessons: lessons.map(mapLessonRecord),
    assignments: assignments.map(mapAssignmentRecord),
    skillProgress: skillProgress.map(mapSkillProgressRecord),
    events: events.map(mapEventRecord),
    achievementDefinitions: definitions.map(mapAchievementDefinitionRecord),
    userAchievements: userAchievements.map(mapUserAchievementRecord),
    progressHistory: progressHistory.map(mapProgressHistoryRecord),
    notifications: [],
  };
}

async function persistUnlocks(
  data: AchievementEvaluationData,
  studentId: string,
  before: { achievements: number; history: number },
): Promise<void> {
  evaluateAndUnlockAchievements(data, studentId, uid);
  const pb = getPocketBase();

  const newAchievements = data.userAchievements.slice(before.achievements);
  const newHistory = data.progressHistory.slice(before.history);

  for (const unlocked of newAchievements) {
    try {
      await pb.collection('user_achievements').create({
        student: studentId,
        achievement: unlocked.achievementId,
        unlockedAt: unlocked.unlockedAt,
      });
    } catch (error) {
      const mapped = mapPocketBaseError(error);
      if (mapped.code !== 'DUPLICATE' && mapped.code !== 'FORBIDDEN') throw error;
    }
  }

  for (const entry of newHistory) {
    try {
      await pb.collection('progress_history').create({
        student: studentId,
        type: entry.type,
        title: entry.title,
        description: entry.description ?? '',
      });
    } catch (error) {
      const mapped = mapPocketBaseError(error);
      if (mapped.code !== 'FORBIDDEN') throw error;
    }
  }

  for (const notification of data.notifications) {
    try {
      await pb.collection('notifications').create({
        user: notification.userId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        read: false,
        link: notification.link ?? '/profile/progress',
      });
    } catch (error) {
      const mapped = mapPocketBaseError(error);
      if (mapped.code !== 'FORBIDDEN') throw error;
    }
  }
}

async function addHistoryEntry(
  entry: Pick<ProgressHistoryEntry, 'studentId' | 'type' | 'title' | 'description'>,
): Promise<void> {
  const pb = getPocketBase();
  try {
    await pb.collection('progress_history').create({
      student: entry.studentId,
      type: entry.type,
      title: entry.title,
      description: entry.description ?? '',
    });
  } catch (error) {
    const mapped = mapPocketBaseError(error);
    if (mapped.code !== 'FORBIDDEN') throw error;
  }
}

async function syncAchievements(studentId: string): Promise<AchievementEvaluationData> {
  const data = await loadEvaluationData(studentId);
  await persistUnlocks(data, studentId, {
    achievements: data.userAchievements.length,
    history: data.progressHistory.length,
  });
  return data;
}

export const pocketbaseProgressApi: ProgressApi = {
  async getAccessibleStudentIds(requesterId) {
    return withPbError(async () => {
      const requester = await getRequesterUser(requesterId);
      return getAssignedIdsForRequester(requester);
    });
  },

  async getSummary(studentId, requesterId) {
    return withPbError(async () => {
      await assertViewAccess(studentId, requesterId);
      const data = await syncAchievements(studentId);
      const pb = getPocketBase();
      const goals = (await pb.collection('progress_goals').getFullList({ filter: studentFilter(studentId) })).map(
        mapProgressGoalRecord,
      );

      return computeProgressSummary({
        studentId,
        lessons: data.lessons,
        assignments: data.assignments,
        goals,
        skillProgress: data.skillProgress,
        achievements: data.achievementDefinitions,
        userAchievements: data.userAchievements,
      });
    });
  },

  async getSkills(studentId, requesterId) {
    return withPbError(async () => {
      await assertViewAccess(studentId, requesterId);
      const pb = getPocketBase();
      const [skills, progress] = await Promise.all([
        pb.collection('skills').getFullList({ sort: 'name' }),
        pb.collection('student_skill_progress').getFullList({ filter: studentFilter(studentId) }),
      ]);
      return buildSkillsWithProgress(
        skills.map(mapSkillRecord),
        progress.map(mapSkillProgressRecord),
        studentId,
      );
    });
  },

  async getGoals(studentId, requesterId) {
    return withPbError(async () => {
      await assertViewAccess(studentId, requesterId);
      const pb = getPocketBase();
      const records = await pb.collection('progress_goals').getFullList({
        filter: studentFilter(studentId),
        sort: '-id',
      });
      return records.map(mapProgressGoalRecord);
    });
  },

  async getHistory(studentId, requesterId, limit = 20) {
    return withPbError(async () => {
      await assertViewAccess(studentId, requesterId);
      const pb = getPocketBase();
      const records = await pb.collection('progress_history').getFullList({
        filter: studentFilter(studentId),
        sort: '-id',
      });
      return records.map(mapProgressHistoryRecord).slice(0, limit);
    });
  },

  async getAchievements(studentId, requesterId) {
    return withPbError(async () => {
      await assertViewAccess(studentId, requesterId);
      const data = await syncAchievements(studentId);
      return buildAchievementsWithStatus(
        data.achievementDefinitions,
        data.userAchievements,
        studentId,
      );
    });
  },

  async createGoal(input: CreateProgressGoalInput, requesterId) {
    return withPbError(async () => {
      const requester = await assertManageGoalsAccess(input.studentId, requesterId);
      const titleCheck = validateGoalTitle(input.title);
      if (!titleCheck.valid) throw new ApiError(titleCheck.message!, 'VALIDATION_ERROR', 400);

      const pb = getPocketBase();
      const record = await pb.collection('progress_goals').create({
        student: input.studentId,
        teacher: requester.role === 'teacher' ? requester.id : '',
        title: input.title.trim(),
        description: input.description?.trim() ?? '',
        targetDate: input.targetDate ?? '',
        status: 'active',
        completedAt: '',
      });

      const goal = mapProgressGoalRecord(record);
      await addHistoryEntry({
        studentId: input.studentId,
        type: 'goal',
        title: `Новая цель: ${goal.title}`,
      });
      return goal;
    });
  },

  async updateGoal(goalId, input: UpdateProgressGoalInput, requesterId) {
    return withPbError(async () => {
      const pb = getPocketBase();
      let existing;
      try {
        existing = mapProgressGoalRecord(await pb.collection('progress_goals').getOne(goalId));
      } catch (error) {
        if (error instanceof ClientResponseError && error.status === 404) {
          throw new ApiError('Цель не найдена', 'NOT_FOUND', 404);
        }
        throw error;
      }

      await assertManageGoalsAccess(existing.studentId, requesterId);

      const body: Record<string, unknown> = {};
      if (input.title !== undefined) {
        const titleCheck = validateGoalTitle(input.title);
        if (!titleCheck.valid) throw new ApiError(titleCheck.message!, 'VALIDATION_ERROR', 400);
        body.title = input.title.trim();
      }
      if (input.description !== undefined) {
        body.description = input.description.trim();
      }
      if (input.targetDate !== undefined) {
        body.targetDate = input.targetDate || '';
      }
      if (input.status !== undefined) {
        body.status = input.status;
        if (input.status === 'completed') {
          body.completedAt = new Date().toISOString();
        }
      }

      const record = await pb.collection('progress_goals').update(goalId, body);
      const goal = mapProgressGoalRecord(record);

      if (input.status === 'completed') {
        await addHistoryEntry({
          studentId: goal.studentId,
          type: 'goal',
          title: `Цель выполнена: ${goal.title}`,
        });
      }

      return goal;
    });
  },

  async updateSkillProgress(input: UpdateSkillProgressInput, requesterId) {
    return withPbError(async () => {
      await assertManageSkillsAccess(input.studentId, requesterId);
      const pb = getPocketBase();

      let skill;
      try {
        skill = mapSkillRecord(await pb.collection('skills').getOne(input.skillId));
      } catch (error) {
        if (error instanceof ClientResponseError && error.status === 404) {
          throw new ApiError('Навык не найден', 'NOT_FOUND', 404);
        }
        throw error;
      }

      const levelCheck = validateSkillLevel(input.level, skill.maxLevel);
      if (!levelCheck.valid) throw new ApiError(levelCheck.message!, 'VALIDATION_ERROR', 400);

      const pbLevel = toPbSkillLevel(input.level);
      const note = input.note?.trim() ?? '';
      const filter = `${studentFilter(input.studentId)} && skill = "${escapePbFilter(input.skillId)}"`;

      let record;
      try {
        const existing = await pb.collection('student_skill_progress').getFirstListItem(filter);
        record = await pb.collection('student_skill_progress').update(existing.id, {
          level: pbLevel,
          note,
        });
      } catch (error) {
        if (!(error instanceof ClientResponseError) || error.status !== 404) {
          throw error;
        }
        try {
          record = await pb.collection('student_skill_progress').create({
            student: input.studentId,
            skill: input.skillId,
            level: pbLevel,
            note,
          });
        } catch (createError) {
          const mapped = mapPocketBaseError(createError);
          if (mapped.code !== 'DUPLICATE') throw createError;
          const existing = await pb.collection('student_skill_progress').getFirstListItem(filter);
          record = await pb.collection('student_skill_progress').update(existing.id, {
            level: pbLevel,
            note,
          });
        }
      }

      await addHistoryEntry({
        studentId: input.studentId,
        type: 'skill',
        title: `Прогресс: ${skill.name}`,
        description: `Уровень: ${input.level}%`,
      });

      await syncAchievements(input.studentId);
      return mapSkillProgressRecord(record);
    });
  },
};
