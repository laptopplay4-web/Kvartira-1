import { cn } from '@/utils';
import type { SupportTicketCategory, SupportTicketStatus } from '@/types';
import { SUPPORT_CATEGORY_LABELS, SUPPORT_STATUS_LABELS } from '@/services/support/helpers';

export type SupportStatusFilter = 'all' | SupportTicketStatus;
export type SupportCategoryFilter = 'all' | SupportTicketCategory;

const STATUS_FILTERS: { id: SupportStatusFilter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'open', label: SUPPORT_STATUS_LABELS.open },
  { id: 'answered', label: SUPPORT_STATUS_LABELS.answered },
  { id: 'closed', label: SUPPORT_STATUS_LABELS.closed },
];

interface SupportTicketFiltersProps {
  status: SupportStatusFilter;
  category: SupportCategoryFilter;
  onStatusChange: (value: SupportStatusFilter) => void;
  onCategoryChange: (value: SupportCategoryFilter) => void;
}

export function SupportTicketFilters({
  status,
  category,
  onStatusChange,
  onCategoryChange,
}: SupportTicketFiltersProps) {
  return (
    <div className="mb-3 space-y-3">
      <div
        className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
        role="tablist"
        aria-label="Фильтр по статусу"
      >
        {STATUS_FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={status === id}
            onClick={() => onStatusChange(id)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-ring min-h-11 md:min-h-0',
              status === id
                ? 'bg-brand-muted text-brand'
                : 'bg-surface-elevated text-text-secondary hover:text-text-primary',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="support-category-filter" className="sr-only">
          Фильтр по категории
        </label>
        <select
          id="support-category-filter"
          value={category}
          onChange={(e) => onCategoryChange(e.target.value as SupportCategoryFilter)}
          className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2.5 text-body-sm focus-ring min-h-11"
        >
          <option value="all">Все категории</option>
          {(Object.entries(SUPPORT_CATEGORY_LABELS) as [SupportTicketCategory, string][]).map(
            ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ),
          )}
        </select>
      </div>
    </div>
  );
}
