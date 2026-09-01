import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, TrendingUp } from 'lucide-react';
import { api } from '@/services/api';
import { SkillProgressBar } from '@/components/progress/SkillProgressBar';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';

interface HomeProgressBlockProps {
  studentId: string;
  requesterId: string;
}

function ProgressStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-surface-elevated/60 px-3 py-2 text-center">
      <p className="text-h3 tabular-nums text-brand">{value}</p>
      <p className="mt-0.5 text-caption text-text-muted">{label}</p>
    </div>
  );
}

export function HomeProgressBlock({ studentId, requesterId }: HomeProgressBlockProps) {
  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['progress', 'summary', studentId],
    queryFn: () => api.progress.getSummary(studentId, requesterId),
  });

  const { data: skills, isLoading: skillsLoading } = useQuery({
    queryKey: ['progress', 'skills', studentId],
    queryFn: () => api.progress.getSkills(studentId, requesterId),
  });

  const isLoading = summaryLoading || skillsLoading;
  const topSkills = [...(skills ?? [])]
    .filter((s) => s.level > 0)
    .sort((a, b) => b.level - a.level)
    .slice(0, 2);

  return (
    <section className="mb-6" aria-labelledby="home-progress-heading">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="home-progress-heading" className="text-label uppercase tracking-wide">
          Прогресс
        </h2>
        <Link to="/profile/progress" className="text-sm text-brand hover:underline">
          Подробнее
        </Link>
      </div>

      {summaryError ? (
        <ErrorState onRetry={() => void refetchSummary()} />
      ) : isLoading ? (
        <Card className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
          <Skeleton className="h-16" />
        </Card>
      ) : summary ? (
        <Card className="space-y-4 p-4">
          <div className="flex items-center gap-2 text-body-sm text-text-secondary">
            <TrendingUp className="h-4 w-4 shrink-0 text-brand" aria-hidden />
            <span>
              {summary.lessonsCompleted} занятий · {summary.assignmentsTotal} ДЗ
              {summary.attendanceRate !== null ? ` · посещаемость ${summary.attendanceRate}%` : ''}
              {' · '}средний навык {summary.averageSkillLevel}%
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ProgressStat label="Занятий" value={summary.lessonsCompleted} />
            <ProgressStat label="ДЗ" value={summary.assignmentsTotal} />
            <ProgressStat
              label="Посещаемость"
              value={summary.attendanceRate !== null ? `${summary.attendanceRate}%` : '—'}
            />
            <ProgressStat
              label="Достижения"
              value={`${summary.achievementsUnlocked}/${summary.achievementsTotal}`}
            />
          </div>

          {topSkills.length > 0 && (
            <div className="space-y-4 border-t border-border pt-4">
              {topSkills.map((skill) => (
                <SkillProgressBar
                  key={skill.id}
                  name={skill.name}
                  level={skill.level}
                  maxLevel={skill.maxLevel}
                />
              ))}
            </div>
          )}

          {summary.achievementsUnlocked > 0 && (
            <p className="flex items-center gap-2 text-caption text-text-muted">
              <Sparkles className="h-3.5 w-3.5 text-brand" aria-hidden />
              {summary.achievementsUnlocked} из {summary.achievementsTotal} достижений получено
            </p>
          )}
        </Card>
      ) : null}
    </section>
  );
}
