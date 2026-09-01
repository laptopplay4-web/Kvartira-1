import { cn } from '@/utils';

interface SkillProgressBarProps {
  name: string;
  description?: string;
  level: number;
  maxLevel: number;
  note?: string;
  className?: string;
}

export function SkillProgressBar({ name, description, level, maxLevel, note, className }: SkillProgressBarProps) {
  const percent = maxLevel > 0 ? Math.min(100, Math.round((level / maxLevel) * 100)) : 0;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{name}</p>
          {description && <p className="text-caption text-text-muted">{description}</p>}
        </div>
        <span className="shrink-0 text-body-sm font-medium text-brand">{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-elevated">
        <div
          className="h-full rounded-full bg-brand transition-all"
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${name}: ${percent}%`}
        />
      </div>
      {note && <p className="text-caption text-text-secondary">{note}</p>}
    </div>
  );
}
