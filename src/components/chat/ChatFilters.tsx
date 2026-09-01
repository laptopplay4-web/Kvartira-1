import { cn } from '@/utils';
import type { LucideIcon } from 'lucide-react';

interface ChatFiltersProps {
  value: 'all' | 'unread' | 'personal' | 'group';
  onChange: (value: 'all' | 'unread' | 'personal' | 'group') => void;
}

const FILTERS: { id: 'all' | 'unread' | 'personal' | 'group'; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'unread', label: 'Непрочитанные' },
  { id: 'personal', label: 'Личные' },
  { id: 'group', label: 'Группы' },
];

export function ChatFilters({ value, onChange }: ChatFiltersProps) {
  return (
    <div className="scroll-x-contained">
      <div className="flex gap-2 pb-1 scrollbar-none" role="tablist" aria-label="Фильтры чатов">
      {FILTERS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          onClick={() => onChange(id)}
          className={cn(
            'shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-ring min-h-[44px] md:min-h-0',
            value === id
              ? 'bg-brand-muted text-brand'
              : 'bg-surface-elevated text-text-secondary hover:text-text-primary',
          )}
        >
          {label}
        </button>
      ))}
      </div>
    </div>
  );
}

export function ChatSearch({
  value,
  onChange,
  icon: Icon,
}: {
  value: string;
  onChange: (v: string) => void;
  icon: LucideIcon;
}) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Поиск"
        aria-label="Поиск чатов"
        className="w-full rounded-xl border border-border bg-surface-elevated py-2.5 pl-10 pr-4 text-sm focus-ring"
      />
    </div>
  );
}
