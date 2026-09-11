import { cn } from '@/utils';
import type { LucideIcon } from 'lucide-react';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import type { ChatFilter } from '@/services/chat/helpers';

interface ChatFiltersProps {
  value: ChatFilter;
  onChange: (value: ChatFilter) => void;
}

const FILTERS: { value: ChatFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'personal', label: 'Личные' },
  { value: 'group', label: 'Группы' },
  { value: 'school', label: 'Общие' },
];

export function ChatFilters({ value, onChange }: ChatFiltersProps) {
  return (
    <div className="scroll-x-contained">
      <SegmentedControl
        className="w-max min-w-full"
        aria-label="Фильтры чатов"
        size="sm"
        value={value}
        options={FILTERS}
        onChange={onChange}
      />
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
    <div className={cn('relative')}>
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
