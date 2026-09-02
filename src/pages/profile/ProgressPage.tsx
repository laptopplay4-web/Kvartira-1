import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  ChevronRight,
  Goal,
  History,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { useCurrentUser } from '@/stores/authStore';
import { api } from '@/services/api';
import { can, actsAsTeacher } from '@/permissions';
import { AchievementBadge } from '@/components/progress/AchievementBadge';
import { SkillProgressBar } from '@/components/progress/SkillProgressBar';
import {
  AddGoalButton,
  CreateGoalModal,
  GoalManageActions,
  SkillManageRow,
} from '@/components/progress/TeacherProgressControls';
import { canManageStudentGoals, canManageStudentSkills } from '@/services/progress/access';import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatFullDate, formatChatListTime } from '@/utils/dates';
import { formatUserName } from '@/utils';

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-4 text-center">
      <p className="text-h2 text-brand">{value}</p>
      <p className="mt-1 text-caption text-text-muted">{label}</p>
    </Card>
  );
}

function ProgressDashboard({
  studentId,
  requesterId,
  canManageGoals,
  canManageSkills,
}: {
  studentId: string;
  requesterId: string;
  canManageGoals: boolean;
  canManageSkills: boolean;
}) {
  const [goalModalOpen, setGoalModalOpen] = useState(false);  const { data: summary, isLoading: summaryLoading, error: summaryError, refetch: refetchSummary } = useQuery({
    queryKey: ['progress', 'summary', studentId],
    queryFn: () => api.progress.getSummary(studentId, requesterId),
  });

  const { data: skills, isLoading: skillsLoading } = useQuery({
    queryKey: ['progress', 'skills', studentId],
    queryFn: () => api.progress.getSkills(studentId, requesterId),
  });

  const { data: goals, isLoading: goalsLoading } = useQuery({
    queryKey: ['progress', 'goals', studentId],
    queryFn: () => api.progress.getGoals(studentId, requesterId),
  });

  const { data: achievements, isLoading: achievementsLoading } = useQuery({
    queryKey: ['progress', 'achievements', studentId],
    queryFn: () => api.progress.getAchievements(studentId, requesterId),
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['progress', 'history', studentId],
    queryFn: () => api.progress.getHistory(studentId, requesterId, 10),
  });

  if (summaryError) {
    return <ErrorState onRetry={() => refetchSummary()} />;
  }

  const isLoading = summaryLoading || skillsLoading || goalsLoading || achievementsLoading || historyLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-40" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  const activeGoals = goals?.filter((g) => g.status === 'active') ?? [];
  const completedGoals = goals?.filter((g) => g.status === 'completed') ?? [];
  const skillsToShow = canManageSkills ? (skills ?? []) : (skills?.filter((s) => s.level > 0) ?? []);
  const showGoalsSection =
    canManageGoals || activeGoals.length > 0 || completedGoals.length > 0;
  return (
    <div className="space-y-8">
      {summary && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-h3">
            <TrendingUp className="h-5 w-5 text-brand" aria-hidden />
            Обзор
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Занятий" value={summary.lessonsCompleted} />
            <StatCard label="Предстоящих" value={summary.lessonsUpcoming} />
            <StatCard
              label="Посещаемость"
              value={summary.attendanceRate !== null ? `${summary.attendanceRate}%` : '—'}
            />
            <StatCard label="Материалов ДЗ" value={summary.assignmentsTotal} />
          </div>
          {summary.attendanceRate !== null ? (
            <p className="mt-3 text-caption text-text-muted">
              {summary.lessonsAttended} посещено · {summary.lessonsMissed} пропусков
              {summary.lessonsCancelled > 0 ? ` · ${summary.lessonsCancelled} отменено` : ''}
              {' · '}средний навык {summary.averageSkillLevel}%
            </p>
          ) : (
            <p className="mt-3 text-caption text-text-muted">
              Средний навык: {summary.averageSkillLevel}%
            </p>
          )}
        </section>
      )}

      {(skillsToShow.length > 0 || canManageSkills) && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-h3">
            <Target className="h-5 w-5 text-brand" aria-hidden />
            Навыки
          </h2>
          <Card className="space-y-5 p-4">
            {skillsToShow.length > 0 ? (
              skillsToShow.map((skill) =>
                canManageSkills ? (
                  <SkillManageRow
                    key={skill.id}
                    skill={skill}
                    studentId={studentId}
                    requesterId={requesterId}
                  />
                ) : (
                  <SkillProgressBar
                    key={skill.id}
                    name={skill.name}
                    description={skill.description}
                    level={skill.level}
                    maxLevel={skill.maxLevel}
                    note={skill.note}
                  />
                ),
              )
            ) : (
              <p className="text-body-sm text-text-muted">Навыки ещё не оценены</p>
            )}
          </Card>
        </section>
      )}

      {showGoalsSection && (
        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-h3">
              <Goal className="h-5 w-5 text-brand" aria-hidden />
              Цели
            </h2>
            {canManageGoals && <AddGoalButton onClick={() => setGoalModalOpen(true)} />}
          </div>
          <div className="space-y-3">
            {activeGoals.map((goal) => (
              <Card key={goal.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{goal.title}</p>
                    {goal.description && (
                      <p className="mt-1 text-body-sm text-text-secondary">{goal.description}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {goal.targetDate && (
                      <span className="text-caption text-text-muted">
                        до {formatFullDate(goal.targetDate)}
                      </span>
                    )}
                    {canManageGoals && <GoalManageActions goal={goal} requesterId={requesterId} />}
                  </div>
                </div>
              </Card>
            ))}
            {completedGoals.map((goal) => (
              <Card key={goal.id} className="p-4 opacity-70">
                <p className="font-medium line-through">{goal.title}</p>
                {goal.completedAt && (
                  <p className="mt-1 text-caption text-text-muted">
                    Выполнено {formatFullDate(goal.completedAt)}
                  </p>
                )}
              </Card>
            ))}
            {activeGoals.length === 0 && completedGoals.length === 0 && canManageGoals && (
              <p className="text-body-sm text-text-muted">Добавьте первую цель для ученика</p>
            )}
          </div>
          {canManageGoals && (
            <CreateGoalModal
              open={goalModalOpen}
              onClose={() => setGoalModalOpen(false)}
              studentId={studentId}
              requesterId={requesterId}
            />
          )}
        </section>
      )}
      {achievements && achievements.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-h3">
            <Sparkles className="h-5 w-5 text-brand" aria-hidden />
            Достижения
            <span className="text-body-sm font-normal text-text-muted">
              {summary?.achievementsUnlocked}/{summary?.achievementsTotal}
            </span>
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {achievements.map((ach) => (
              <AchievementBadge
                key={ach.id}
                title={ach.title}
                description={ach.description}
                icon={ach.icon}
                unlocked={ach.unlocked}
                unlockedAt={ach.unlockedAt}
              />
            ))}
          </div>
        </section>
      )}

      {history && history.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-h3">
            <History className="h-5 w-5 text-brand" aria-hidden />
            История
          </h2>
          <div className="space-y-2">
            {history.map((entry) => (
              <Card key={entry.id} className="flex items-start gap-3 p-4">
                <div className="mt-0.5 text-text-muted">
                  {entry.type === 'lesson' && <Calendar className="h-4 w-4" aria-hidden />}
                  {entry.type === 'assignment' && <BookOpen className="h-4 w-4" aria-hidden />}
                  {entry.type === 'achievement' && <Sparkles className="h-4 w-4" aria-hidden />}
                  {!['lesson', 'assignment', 'achievement'].includes(entry.type) && (
                    <History className="h-4 w-4" aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-medium">{entry.title}</p>
                  {entry.description && (
                    <p className="mt-0.5 text-caption text-text-secondary">{entry.description}</p>
                  )}
                  <p className="mt-1 text-caption text-text-muted">{formatChatListTime(entry.createdAt)}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StudentPicker() {
  const user = useCurrentUser()!;

  const { data: studentIds, isLoading: idsLoading, error, refetch } = useQuery({
    queryKey: ['progress', 'accessible', user.id],
    queryFn: () => api.progress.getAccessibleStudentIds(user.id),
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.users.getAllUsers(user.id),
    enabled: !!studentIds && studentIds.length > 0,
  });

  const { data: summaries, isLoading: summariesLoading } = useQuery({
    queryKey: ['progress', 'summaries', user.id, studentIds],
    queryFn: async () => {
      if (!studentIds) return [];
      return Promise.all(studentIds.map((id) => api.progress.getSummary(id, user.id)));
    },
    enabled: !!studentIds && studentIds.length > 0,
  });

  if (error) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  if (idsLoading || usersLoading || summariesLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  if (!studentIds || studentIds.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="Нет учеников"
        description="Прогресс появится, когда у вас будут занятия с учениками"
        className="py-8"
      />
    );
  }

  const summaryByStudent = new Map(summaries?.map((s) => [s.studentId, s]));

  return (
    <div className="space-y-3">
      {studentIds.map((studentId) => {
        const student = users?.find((u) => u.id === studentId);
        const summary = summaryByStudent.get(studentId);
        return (
          <Link key={studentId} to={`/profile/progress?student=${studentId}`}>
            <Card interactive className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{student ? formatUserName(student) : studentId}</p>
                {summary && (
                  <p className="mt-1 text-caption text-text-muted">
                    {summary.lessonsCompleted} занятий · {summary.achievementsUnlocked} достижений · навыки{' '}
                    {summary.averageSkillLevel}%
                  </p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

export default function ProgressPage() {
  const user = useCurrentUser()!;
  const [searchParams, setSearchParams] = useSearchParams();
  const studentParam = searchParams.get('student');

  const isStudent = can(user, 'progress:view-own') && user.role === 'student';
  const viewingStudentId = isStudent ? user.id : studentParam;

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.users.getAllUsers(user.id),
    enabled: !isStudent && !!viewingStudentId,
  });

  const viewedStudent = users?.find((u) => u.id === viewingStudentId);

  const { data: accessibleStudentIds } = useQuery({
    queryKey: ['progress', 'accessible', user.id],
    queryFn: () => api.progress.getAccessibleStudentIds(user.id),
    enabled: !isStudent && !!viewingStudentId,
  });

  const assignedIds = accessibleStudentIds ?? [];
  const manageGoals =
    !!viewingStudentId && canManageStudentGoals(user, viewingStudentId, assignedIds);
  const manageSkills =
    !!viewingStudentId && canManageStudentSkills(user, viewingStudentId, assignedIds);
  const subtitle = () => {
    if (isStudent) return 'Ваш прогресс обучения';
    if (viewingStudentId && viewedStudent) return `Прогресс: ${formatUserName(viewedStudent)}`;
    if (actsAsTeacher(user.role)) return 'Прогресс ваших учеников';
    return 'Прогресс учеников школы';
  };

  return (
    <div className="page-container max-w-2xl">
      {!isStudent && viewingStudentId && (
        <button
          type="button"
          onClick={() => setSearchParams({})}
          className="mb-4 flex min-h-11 items-center gap-1 text-body-sm text-brand"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          К списку учеников
        </button>
      )}

      <header className="mb-6">
        <h1 className="text-h1 mb-1">Прогресс</h1>
        <p className="text-body-sm text-text-secondary">{subtitle()}</p>
      </header>

      {viewingStudentId ? (
        <ProgressDashboard
          studentId={viewingStudentId}
          requesterId={user.id}
          canManageGoals={manageGoals}
          canManageSkills={manageSkills}
        />
      ) : (        <StudentPicker />
      )}
    </div>
  );
}
