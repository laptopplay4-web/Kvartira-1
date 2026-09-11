import type { SupportTicketCategory, SupportTicketStatus } from '@/types';
import { SUPPORT_CATEGORY_LABELS, SUPPORT_STATUS_LABELS } from '@/services/support/helpers';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

export type SupportStatusFilter = 'all' | SupportTicketStatus;
export type SupportCategoryFilter = 'all' | SupportTicketCategory;

const STATUS_FILTERS: { value: SupportStatusFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'open', label: SUPPORT_STATUS_LABELS.open },
  { value: 'answered', label: SUPPORT_STATUS_LABELS.answered },
  { value: 'closed', label: SUPPORT_STATUS_LABELS.closed },
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
      <SegmentedControl
        className="w-max min-w-full"
        aria-label="Фильтр по статусу"
        size="sm"
        value={status}
        options={STATUS_FILTERS}
        onChange={onStatusChange}
      />

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
