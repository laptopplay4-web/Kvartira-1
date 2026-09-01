import { getISOWeek, getISOWeekYear } from 'date-fns';
import type {
  AchievementDefinition,
  AppNotification,
  Assignment,
  Lesson,
  ProgressHistoryEntry,
  SchoolEvent,
  StudentSkillProgress,
  UserAchievement,
} from '@/types';
import { isLessonPast } from '@/services/calendar/helpers';

export interface AchievementEvaluationData {
  lessons: Lesson[];
  assignments: Assignment[];
  skillProgress: StudentSkillProgress[];
  events: SchoolEvent[];
  achievementDefinitions: AchievementDefinition[];
  userAchievements: UserAchievement[];
  progressHistory: ProgressHistoryEntry[];
  notifications: AppNotification[];
}

export interface UnlockedAchievement {
  achievementId: string;
  code: string;
  title: string;
}

const SKILL_MASTER_THRESHOLD = 80;
const REGULARITY_WEEKS_REQUIRED = 4;
const PERFORMANCE_EVENT_TYPES = new Set<SchoolEvent['type']>(['concert', 'competition', 'masterclass']);

export function isLessonCompleted(lesson: Lesson): boolean {
  if (lesson.status === 'cancelled') return false;
  if (lesson.status === 'completed') return true;
  return isLessonPast(lesson) && lesson.status !== 'cancelled';
}

export function countCompletedLessons(lessons: Lesson[], studentId: string): number {
  return lessons.filter((l) => l.studentId === studentId && isLessonCompleted(l)).length;
}

function weekNumber(date: string): number {
  const d = new Date(`${date}T12:00:00`);
  return getISOWeekYear(d) * 53 + getISOWeek(d);
}

export function hasLessonRegularity(lessons: Lesson[], studentId: string, weeksRequired = REGULARITY_WEEKS_REQUIRED): boolean {
  const weeks = [
    ...new Set(
      lessons
        .filter((l) => l.studentId === studentId && isLessonCompleted(l))
        .map((l) => weekNumber(l.date)),
    ),
  ].sort((a, b) => a - b);

  if (weeks.length < weeksRequired) return false;

  let streak = 1;
  for (let i = 1; i < weeks.length; i++) {
    if (weeks[i] === weeks[i - 1]! + 1) {
      streak += 1;
      if (streak >= weeksRequired) return true;
    } else if (weeks[i] !== weeks[i - 1]) {
      streak = 1;
    }
  }
  return false;
}

export function hasSkillMasterLevel(skillProgress: StudentSkillProgress[], studentId: string): boolean {
  return skillProgress.some((p) => p.studentId === studentId && p.level >= SKILL_MASTER_THRESHOLD);
}

export function hasPerformanceParticipation(events: SchoolEvent[], studentId: string): boolean {
  return events.some(
    (event) =>
      PERFORMANCE_EVENT_TYPES.has(event.type) && event.registeredUserIds.includes(studentId),
  );
}

export function isAchievementUnlocked(
  userAchievements: UserAchievement[],
  studentId: string,
  achievementId: string,
): boolean {
  return userAchievements.some((a) => a.studentId === studentId && a.achievementId === achievementId);
}

export function meetsAchievementCriteria(
  code: AchievementDefinition['code'],
  data: AchievementEvaluationData,
  studentId: string,
): boolean {
  switch (code) {
    case 'first_lesson':
      return countCompletedLessons(data.lessons, studentId) >= 1;
    case 'ten_lessons':
      return countCompletedLessons(data.lessons, studentId) >= 10;
    case 'skill_master':
      return hasSkillMasterLevel(data.skillProgress, studentId);
    case 'regularity':
      return hasLessonRegularity(data.lessons, studentId);
    case 'first_performance':
      return hasPerformanceParticipation(data.events, studentId);
    default:
      return false;
  }
}

export function evaluateAndUnlockAchievements(
  data: AchievementEvaluationData,
  studentId: string,
  createId: (prefix: string) => string,
): UnlockedAchievement[] {
  const unlocked: UnlockedAchievement[] = [];
  const now = new Date().toISOString();

  for (const definition of data.achievementDefinitions) {
    if (isAchievementUnlocked(data.userAchievements, studentId, definition.id)) continue;
    if (!meetsAchievementCriteria(definition.code, data, studentId)) continue;

    data.userAchievements.push({
      id: createId('uach'),
      studentId,
      achievementId: definition.id,
      unlockedAt: now,
    });

    data.progressHistory.push({
      id: createId('hist-prog'),
      studentId,
      type: 'achievement',
      title: `Достижение: ${definition.title}`,
      description: definition.description,
      createdAt: now,
    });

    data.notifications.push({
      id: createId('notif'),
      userId: studentId,
      type: 'system',
      title: 'Новое достижение',
      body: definition.title,
      read: false,
      createdAt: now,
      link: '/profile/progress',
    });

    unlocked.push({
      achievementId: definition.id,
      code: definition.code,
      title: definition.title,
    });
  }

  return unlocked;
}
