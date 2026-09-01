import { describe, it, expect, beforeEach } from 'vitest';
import { mockProgressApi, mockEventsApi, resetMockDatabase } from '@/services/api/mock';
import { canViewStudentProgress, canManageStudentGoals, canManageStudentSkills } from '@/services/progress/access';
import {
  countCompletedLessons,
  evaluateAndUnlockAchievements,
  hasLessonRegularity,
  hasPerformanceParticipation,
  hasSkillMasterLevel,
  isLessonCompleted,
  meetsAchievementCriteria,
} from '@/services/progress/achievements';
import { computeProgressSummary, computeAttendanceStats, getAssignedStudentIds, isLessonAttended, isLessonMissed } from '@/services/progress/helpers';
import { achievementDefinitions } from '@/mocks/seed';
import type { Lesson, SchoolEvent, User } from '@/types';
const student: User = {
  id: 'user-student',
  phone: '+7',
  role: 'student',
  firstName: 'A',
  lastName: 'B',
};
const teacher: User = {
  id: 'user-teacher-1',
  phone: '+7',
  role: 'teacher',
  firstName: 'C',
  lastName: 'D',
};
const otherStudent: User = {
  id: 'user-student-2',
  phone: '+7',
  role: 'student',
  firstName: 'E',
  lastName: 'F',
};
const admin: User = {
  id: 'user-admin',
  phone: '+7',
  role: 'admin',
  firstName: 'G',
  lastName: 'H',
};

describe('progress access', () => {
  it('student can view own progress', () => {
    expect(canViewStudentProgress(student, student.id, [])).toBe(true);
  });

  it('student cannot view others progress', () => {
    expect(canViewStudentProgress(student, otherStudent.id, [])).toBe(false);
  });

  it('teacher can view assigned student', () => {
    expect(canViewStudentProgress(teacher, student.id, [student.id])).toBe(true);
  });

  it('teacher cannot view unassigned student', () => {
    expect(canViewStudentProgress(teacher, otherStudent.id, [student.id])).toBe(false);
  });

  it('admin can view any student', () => {
    expect(canViewStudentProgress(admin, otherStudent.id, [])).toBe(true);
  });

  it('teacher can manage goals for assigned student', () => {
    expect(canManageStudentGoals(teacher, student.id, [student.id])).toBe(true);
    expect(canManageStudentGoals(teacher, otherStudent.id, [student.id])).toBe(false);
  });

  it('student cannot manage goals or skills', () => {
    expect(canManageStudentGoals(student, student.id, [])).toBe(false);
    expect(canManageStudentSkills(student, student.id, [])).toBe(false);
  });
});

describe('progress helpers', () => {
  it('getAssignedStudentIds returns unique students from lessons', () => {
    const ids = getAssignedStudentIds(
      [
        { studentId: 'user-student', teacherId: 'user-teacher-1' } as never,
        { studentId: 'user-student-2', teacherId: 'user-teacher-1' } as never,
        { studentId: 'user-student', teacherId: 'user-teacher-1' } as never,
      ],
      'user-teacher-1',
    );
    expect(ids).toHaveLength(2);
    expect(ids).toContain('user-student');
    expect(ids).toContain('user-student-2');
  });

  it('computeProgressSummary aggregates stats', () => {
    const summary = computeProgressSummary({
      studentId: 'user-student',
      lessons: [
        { studentId: 'user-student', status: 'completed', date: '2020-01-01', startTime: '10:00' } as never,
        { studentId: 'user-student', status: 'scheduled', date: '2099-01-01', startTime: '10:00' } as never,
      ],
      assignments: [
        { studentId: 'user-student', status: 'reviewed' } as never,
        { studentId: 'user-student', status: 'assigned' } as never,
      ],
      goals: [
        { studentId: 'user-student', status: 'active' } as never,
        { studentId: 'user-student', status: 'completed' } as never,
      ],
      skillProgress: [
        { studentId: 'user-student', level: 40 } as never,
        { studentId: 'user-student', level: 60 } as never,
      ],
      achievements: [{ id: 'a1' }, { id: 'a2' }] as never,
      userAchievements: [{ studentId: 'user-student', achievementId: 'a1' }] as never,
    });

    expect(summary.lessonsTotal).toBe(2);
    expect(summary.lessonsCompleted).toBe(1);
    expect(summary.lessonsUpcoming).toBe(1);
    expect(summary.assignmentsReviewed).toBe(1);
    expect(summary.activeGoals).toBe(1);
    expect(summary.completedGoals).toBe(1);
    expect(summary.averageSkillLevel).toBe(50);
    expect(summary.achievementsUnlocked).toBe(1);
    expect(summary.achievementsTotal).toBe(2);
    expect(summary.lessonsAttended).toBe(1);
    expect(summary.lessonsMissed).toBe(0);
    expect(summary.attendanceRate).toBe(100);
  });

  it('computeAttendanceStats counts attended, missed, and cancelled', () => {
    const lessons: Lesson[] = [
      {
        id: 'l1',
        studentId: 'user-student',
        teacherId: 't1',
        directionId: 'd1',
        date: '2020-01-01',
        startTime: '10:00',
        durationMinutes: 60,
        status: 'completed',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'l2',
        studentId: 'user-student',
        teacherId: 't1',
        directionId: 'd1',
        date: '2020-01-08',
        startTime: '10:00',
        durationMinutes: 60,
        status: 'no_show',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'l3',
        studentId: 'user-student',
        teacherId: 't1',
        directionId: 'd1',
        date: '2020-01-15',
        startTime: '10:00',
        durationMinutes: 60,
        status: 'cancelled',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'l4',
        studentId: 'user-student',
        teacherId: 't1',
        directionId: 'd1',
        date: '2099-01-01',
        startTime: '10:00',
        durationMinutes: 60,
        status: 'scheduled',
        createdAt: '',
        updatedAt: '',
      },
    ];

    expect(isLessonAttended(lessons[0]!)).toBe(true);
    expect(isLessonMissed(lessons[1]!)).toBe(true);
    expect(isLessonMissed(lessons[2]!)).toBe(false);
    expect(isLessonMissed(lessons[3]!)).toBe(false);

    const stats = computeAttendanceStats(lessons, 'user-student');
    expect(stats.lessonsAttended).toBe(1);
    expect(stats.lessonsMissed).toBe(1);
    expect(stats.lessonsCancelled).toBe(1);
    expect(stats.attendanceRate).toBe(50);
  });
});

describe('achievement evaluation', () => {
  const studentId = 'user-student';

  function makeLesson(overrides: Partial<Lesson> & Pick<Lesson, 'date'>): Lesson {
    return {
      id: 'lesson-x',
      studentId,
      teacherId: 'user-teacher-1',
      directionId: 'dir-vocal',
      startTime: '10:00',
      durationMinutes: 60,
      status: 'completed',
      location: 'Студия',
      createdAt: '2020-01-01T00:00:00.000Z',
      updatedAt: '2020-01-01T00:00:00.000Z',
      ...overrides,
    };
  }

  function emptyData() {
    return {
      lessons: [] as Lesson[],
      assignments: [],
      skillProgress: [],
      events: [] as SchoolEvent[],
      achievementDefinitions,
      userAchievements: [],
      progressHistory: [],
      notifications: [],
    };
  }

  it('isLessonCompleted treats past scheduled lessons as completed', () => {
    expect(isLessonCompleted(makeLesson({ date: '2020-01-01', status: 'scheduled' }))).toBe(true);
    expect(isLessonCompleted(makeLesson({ date: '2099-01-01', status: 'scheduled' }))).toBe(false);
    expect(isLessonCompleted(makeLesson({ date: '2020-01-01', status: 'cancelled' }))).toBe(false);
  });

  it('unlocks first_lesson and first_performance when criteria met', () => {
    const data = emptyData();
    data.lessons.push(makeLesson({ date: '2024-01-01' }));
    data.events.push({
      id: 'event-1',
      title: 'Концерт',
      description: '',
      type: 'concert',
      date: '2024-02-01',
      startTime: '18:00',
      endTime: '20:00',
      location: 'Зал',
      registeredUserIds: [studentId],
    });

    const unlocked = evaluateAndUnlockAchievements(data, studentId, (p) => `${p}-1`);

    expect(unlocked.map((a) => a.code).sort()).toEqual(['first_lesson', 'first_performance']);
    expect(data.userAchievements).toHaveLength(2);
    expect(data.progressHistory.filter((h) => h.type === 'achievement')).toHaveLength(2);
    expect(data.notifications.some((n) => n.title === 'Новое достижение')).toBe(true);
  });

  it('does not unlock the same achievement twice', () => {
    const data = emptyData();
    data.lessons.push(makeLesson({ date: '2024-01-01' }));
    evaluateAndUnlockAchievements(data, studentId, (p) => `${p}-1`);
    const second = evaluateAndUnlockAchievements(data, studentId, (p) => `${p}-2`);
    expect(second).toHaveLength(0);
    expect(data.userAchievements.filter((a) => a.achievementId === 'ach-first-lesson')).toHaveLength(1);
  });

  it('unlocks ten_lessons after 10 completed lessons', () => {
    const data = emptyData();
    for (let i = 0; i < 10; i++) {
      data.lessons.push(makeLesson({ id: `lesson-${i}`, date: `2024-01-${String(i + 1).padStart(2, '0')}` }));
    }
    const unlocked = evaluateAndUnlockAchievements(data, studentId, (p) => `${p}-1`);
    expect(unlocked.some((a) => a.code === 'ten_lessons')).toBe(true);
    expect(countCompletedLessons(data.lessons, studentId)).toBe(10);
  });

  it('unlocks skill_master at 80% level', () => {
    const data = emptyData();
    data.skillProgress.push({
      id: 'prog-1',
      studentId,
      skillId: 'skill-vocal',
      level: 80,
      updatedAt: '2024-01-01T00:00:00.000Z',
    });
    expect(hasSkillMasterLevel(data.skillProgress, studentId)).toBe(true);
    const unlocked = evaluateAndUnlockAchievements(data, studentId, (p) => `${p}-1`);
    expect(unlocked.some((a) => a.code === 'skill_master')).toBe(true);
  });

  it('detects 4 consecutive lesson weeks', () => {
    const lessons = [
      makeLesson({ id: 'l1', date: '2024-01-02' }),
      makeLesson({ id: 'l2', date: '2024-01-09' }),
      makeLesson({ id: 'l3', date: '2024-01-16' }),
      makeLesson({ id: 'l4', date: '2024-01-23' }),
    ];
    expect(hasLessonRegularity(lessons, studentId)).toBe(true);
    expect(meetsAchievementCriteria('regularity', { ...emptyData(), lessons }, studentId)).toBe(true);
  });

  it('syncs achievements on progress summary read', async () => {
    resetMockDatabase();
    const summary = await mockProgressApi.getSummary('user-student', 'user-student');
    const achievements = await mockProgressApi.getAchievements('user-student', 'user-student');
    expect(summary.achievementsUnlocked).toBeGreaterThanOrEqual(2);
    expect(achievements.some((a) => a.code === 'first_performance' && a.unlocked)).toBe(true);
  });

  it('unlocks first_performance on event registration', async () => {
    resetMockDatabase();
    await mockEventsApi.register('event-2', 'user-student-2');
    const achievements = await mockProgressApi.getAchievements('user-student-2', 'user-student-2');
    expect(achievements.find((a) => a.code === 'first_performance')?.unlocked).toBe(true);
    expect(hasPerformanceParticipation(
      [{ id: 'e', title: '', description: '', type: 'masterclass', date: '2024-01-01', startTime: '10:00', endTime: '12:00', location: '', registeredUserIds: ['user-student-2'] }],
      'user-student-2',
    )).toBe(true);
  });
});

describe('mock progress API', () => {
  beforeEach(() => resetMockDatabase());

  it('student sees own summary with attendance', async () => {
    const summary = await mockProgressApi.getSummary('user-student', 'user-student');
    expect(summary.studentId).toBe('user-student');
    expect(summary.averageSkillLevel).toBeGreaterThan(0);
    expect(summary.lessonsAttended).toBe(1);
    expect(summary.lessonsMissed).toBe(1);
    expect(summary.attendanceRate).toBe(50);
  });

  it('student cannot access other student progress', async () => {
    await expect(mockProgressApi.getSummary('user-student-2', 'user-student')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('teacher sees assigned students', async () => {
    const ids = await mockProgressApi.getAccessibleStudentIds('user-teacher-1');
    expect(ids).toContain('user-student');
    expect(ids).toContain('user-student-2');
  });

  it('teacher can view assigned student progress', async () => {
    const skills = await mockProgressApi.getSkills('user-student', 'user-teacher-1');
    expect(skills.some((s) => s.level > 0)).toBe(true);
  });

  it('teacher cannot view unassigned student', async () => {
    await expect(mockProgressApi.getSkills('user-student-2', 'user-teacher-2')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('admin can view all students', async () => {
    const ids = await mockProgressApi.getAccessibleStudentIds('user-admin');
    expect(ids.length).toBeGreaterThanOrEqual(2);
  });

  it('returns achievements with unlock status', async () => {
    const achievements = await mockProgressApi.getAchievements('user-student', 'user-student');
    expect(achievements.length).toBeGreaterThan(0);
    expect(achievements.some((a) => a.unlocked)).toBe(true);
    expect(achievements.some((a) => !a.unlocked)).toBe(true);
  });

  it('returns progress history sorted newest first', async () => {
    const history = await mockProgressApi.getHistory('user-student', 'user-student');
    expect(history.length).toBeGreaterThan(0);
    for (let i = 1; i < history.length; i++) {
      expect(history[i - 1]!.createdAt >= history[i]!.createdAt).toBe(true);
    }
  });

  it('teacher creates goal for assigned student', async () => {
    const goal = await mockProgressApi.createGoal(
      { studentId: 'user-student', title: 'Выучить этюд' },
      'user-teacher-1',
    );
    expect(goal.title).toBe('Выучить этюд');
    expect(goal.status).toBe('active');
    const goals = await mockProgressApi.getGoals('user-student', 'user-teacher-1');
    expect(goals.some((g) => g.id === goal.id)).toBe(true);
  });

  it('student cannot create goal', async () => {
    await expect(
      mockProgressApi.createGoal({ studentId: 'user-student', title: 'Test' }, 'user-student'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('teacher completes goal', async () => {
    const created = await mockProgressApi.createGoal(
      { studentId: 'user-student', title: 'Цель для завершения' },
      'user-teacher-1',
    );
    const updated = await mockProgressApi.updateGoal(
      created.id,
      { status: 'completed' },
      'user-teacher-1',
    );
    expect(updated.status).toBe('completed');
    expect(updated.completedAt).toBeTruthy();
  });

  it('teacher updates skill progress and can unlock skill_master', async () => {
    await mockProgressApi.updateSkillProgress(
      { studentId: 'user-student-2', skillId: 'skill-scales', level: 80 },
      'user-teacher-1',
    );
    const achievements = await mockProgressApi.getAchievements('user-student-2', 'user-teacher-1');
    expect(achievements.find((a) => a.code === 'skill_master')?.unlocked).toBe(true);
  });

  it('rejects invalid skill level', async () => {
    await expect(
      mockProgressApi.updateSkillProgress(
        { studentId: 'user-student', skillId: 'skill-breathing', level: 150 },
        'user-teacher-1',
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
