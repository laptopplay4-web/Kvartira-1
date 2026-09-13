import { cn } from '@/utils';

interface EventParticipationDeltaBadgesProps {
  joins: number;
  leaves: number;
  /** stacked next to icon vs inline on card */
  layout?: 'stack' | 'inline';
  className?: string;
}

function formatDelta(n: number): string {
  return n > 9 ? '9+' : String(n);
}

export function EventParticipationDeltaBadges({
  joins,
  leaves,
  layout = 'stack',
  className,
}: EventParticipationDeltaBadgesProps) {
  if (joins <= 0 && leaves <= 0) return null;

  return (
    <span
      className={cn(
        'pointer-events-none z-10 flex items-end gap-0.5',
        layout === 'stack' ? 'flex-col' : 'flex-row flex-wrap justify-end',
        className,
      )}
      aria-label={[
        joins > 0 ? `Новых записей: ${joins}` : null,
        leaves > 0 ? `Отмен: ${leaves}` : null,
      ]
        .filter(Boolean)
        .join(', ')}
    >
      {joins > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold leading-none text-brand-contrast shadow-sm ring-2 ring-surface">
          +{formatDelta(joins)}
        </span>
      )}
      {leaves > 0 && (
        <span
          className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold leading-none text-white shadow-sm ring-2 ring-surface"
          style={{ backgroundColor: 'var(--color-danger)' }}
        >
          -{formatDelta(leaves)}
        </span>
      )}
    </span>
  );
}
