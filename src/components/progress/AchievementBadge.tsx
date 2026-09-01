import { Award, Calendar, Mic, Music, Star, type LucideIcon } from 'lucide-react';
import { cn } from '@/utils';

const ICON_MAP: Record<string, LucideIcon> = {
  music: Music,
  calendar: Calendar,
  star: Star,
  award: Award,
  mic: Mic,
};

interface AchievementBadgeProps {
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
  className?: string;
}

export function AchievementBadge({
  title,
  description,
  icon,
  unlocked,
  unlockedAt,
  className,
}: AchievementBadgeProps) {
  const Icon = ICON_MAP[icon] ?? Award;

  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-xl border p-4 text-center transition-colors',
        unlocked ? 'border-brand/40 bg-brand/5' : 'border-border bg-surface opacity-60',
        className,
      )}
      title={unlocked && unlockedAt ? new Date(unlockedAt).toLocaleDateString('ru-RU') : undefined}
    >
      <div
        className={cn(
          'mb-3 flex h-12 w-12 items-center justify-center rounded-full',
          unlocked ? 'bg-brand/15 text-brand' : 'bg-surface-elevated text-text-muted',
        )}
      >
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <p className="text-body-sm font-medium">{title}</p>
      <p className="mt-1 text-caption text-text-muted">{description}</p>
    </div>
  );
}
