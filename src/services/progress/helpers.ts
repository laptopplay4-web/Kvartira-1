import type {
  Assignment,
  Lesson,
  ProgressGoal,
  Skill,
  SkillWithProgress,
  StudentProgressSummary,
  StudentSkillProgress,
  UserAchievement,
  AchievementDefinition,
  AchievementWithStatus,
} from '@/types';
import { isLessonPast } from '@/services/calendar/helpers';
import { isLessonCompleted } from '@/services/progress/achievements';

const MISSED_LESSON_STATUSES = new Set<Lesson['status']>([
  'scheduled',
  'confirmed',
  'pending',
  'rescheduled',
]);

export function isLessonAttended(lesson: Lesson): boolean {
  return lesson.status === 'completed';
}

export function isLessonMissed(lesson: Lesson, now = new Date()): boolean {
  if (lesson.status === 'cancelled' || lesson.status === 'completed') return false;
  if (lesson.status === 'no_show') return true;
  return isLessonPast(lesson, now) && MISSED_LESSON_STATUSES.has(lesson.status);
}

export function computeAttendanceStats(lessons: Lesson[], studentId: string, now = new Date()) {
  const studentLessons = lessons.filter((l) => l.studentId === studentId);
  const lessonsCancelled = studentLessons.filter((l) => l.status === 'cancelled').length;
  const lessonsAttended = studentLessons.filter((l) => isLessonAttended(l)).length;
  const lessonsMissed = studentLessons.filter((l) => isLessonMissed(l, now)).length;
  const measurable = lessonsAttended + lessonsMissed;
  const attendanceRate = measurable > 0 ? Math.round((lessonsAttended / measurable) * 100) : null;

  return { lessonsAttended, lessonsMissed, lessonsCancelled, attendanceRate };
}

export function getAssignedStudentIds(lessons: Lesson[], teacherId: string): string[] {
  const ids = new Set<string>();
  for (const lesson of lessons) {
    if (lesson.teacherId === teacherId) ids.add(lesson.studentId);
  }
  return [...ids];
}

export function buildSkillsWithProgress(
  skills: Skill[],
  progressRecords: StudentSkillProgress[],
  studentId: string,
): SkillWithProgress[] {
  const bySkill = new Map(progressRecords.filter((p) => p.studentId === studentId).map((p) => [p.skillId, p]));

  return skills.map((skill) => {
    const record = bySkill.get(skill.id);
    return {
      ...skill,
      level: record?.level ?? 0,
      progressId: record?.id,
      note: record?.note,
      updatedAt: record?.updatedAt,
    };
  });
}

export function buildAchievementsWithStatus(
  definitions: AchievementDefinition[],
  unlocked: UserAchievement[],
  studentId: string,
): AchievementWithStatus[] {
  const byAchievement = new Map(
    unlocked.filter((a) => a.studentId === studentId).map((a) => [a.achievementId, a]),
  );

  return definitions.map((def) => {
    const record = byAchievement.get(def.id);
    return {
      ...def,
      unlocked: !!record,
      unlockedAt: record?.unlockedAt,
    };
  });
}

export function computeProgressSummary(params: {
  studentId: string;
  lessons: Lesson[];
  assignments: Assignment[];
  goals: ProgressGoal[];
  skillProgress: StudentSkillProgress[];
  achievements: AchievementDefinition[];
  userAchievements: UserAchievement[];
}): StudentProgressSummary {
  const { studentId, lessons, assignments, goals, skillProgress, achievements, userAchievements } = params;

  const studentLessons = lessons.filter((l) => l.studentId === studentId);
  const completed = studentLessons.filter((l) => isLessonCompleted(l));
  const upcoming = studentLessons.filter((l) => !isLessonPast(l) && l.status !== 'cancelled');
  const attendance = computeAttendanceStats(lessons, studentId);

  const studentAssignments = assignments.filter((a) => a.studentId === studentId);
  const reviewed = studentAssignments.filter((a) => a.status === 'reviewed');

  const studentGoals = goals.filter((g) => g.studentId === studentId);
  const activeGoals = studentGoals.filter((g) => g.status === 'active');
  const completedGoals = studentGoals.filter((g) => g.status === 'completed');

  const studentSkills = skillProgress.filter((p) => p.studentId === studentId);
  const averageSkillLevel =
    studentSkills.length > 0
      ? Math.round(studentSkills.reduce((sum, p) => sum + p.level, 0) / studentSkills.length)
      : 0;

  const unlocked = userAchievements.filter((a) => a.studentId === studentId);

  return {
    studentId,
    lessonsCompleted: completed.length,
    lessonsUpcoming: upcoming.length,
    lessonsTotal: studentLessons.length,
    ...attendance,
    assignmentsReviewed: reviewed.length,
    assignmentsTotal: studentAssignments.length,
    activeGoals: activeGoals.length,
    completedGoals: completedGoals.length,
    achievementsUnlocked: unlocked.length,
    achievementsTotal: achievements.length,
    averageSkillLevel,
  };
}
