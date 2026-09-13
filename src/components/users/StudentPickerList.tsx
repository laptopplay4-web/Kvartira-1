import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { cn, formatUserName } from '@/utils';
import type { Direction, User } from '@/types';
import {
  filterStudentsByDirection,
  formatStudentDirectionLabels,
  type GroupMemberDirectionFilter,
} from '@/services/assignments/groups/helpers';
import { filterUsersBySearchQuery } from '@/services/users/helpers';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';

export interface StudentPickerListProps {
  students: User[];
  directions: Direction[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  mode?: 'multiple' | 'single';
  disabled?: boolean;
  emptyAllLabel?: string;
  emptyFilterLabel?: string;
}

export function StudentPickerList({
  students,
  directions,
  selectedIds,
  onChange,
  mode = 'multiple',
  disabled,
  emptyAllLabel = 'Нет учеников',
  emptyFilterLabel = 'Нет учеников по выбранному направлению',
}: StudentPickerListProps) {
  const [directionFilter, setDirectionFilter] = useState<GroupMemberDirectionFilter>('all');
  const [query, setQuery] = useState('');

  const filteredStudents = useMemo(() => {
    const byDirection = filterStudentsByDirection(students, directionFilter);
    const byQuery = filterUsersBySearchQuery(byDirection, query);
    return [...byQuery].sort((a, b) => formatUserName(a).localeCompare(formatUserName(b), 'ru'));
  }, [students, directionFilter, query]);

  const toggleStudent = (id: string) => {
    if (mode === 'single') {
      onChange(selectedIds[0] === id ? [] : [id]);
      return;
    }
    onChange(
      selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id],
    );
  };

  const selectAllFiltered = () => {
    if (mode !== 'multiple') return;
    const ids = filteredStudents.map((student) => student.id);
    onChange([...new Set([...selectedIds, ...ids])]);
  };

  const clearFiltered = () => {
    if (mode !== 'multiple') return;
    const filteredIds = new Set(filteredStudents.map((student) => student.id));
    onChange(selectedIds.filter((id) => !filteredIds.has(id)));
  };

  const showSelectAll = mode === 'multiple' && filteredStudents.length > 0;
  const allFilteredSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((student) => selectedIds.includes(student.id));
  const someFilteredSelected = filteredStudents.some((student) => selectedIds.includes(student.id));

  const emptyMessage =
    students.length === 0
      ? emptyAllLabel
      : query.trim()
        ? 'Ничего не найдено'
        : emptyFilterLabel;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative shrink-0">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={disabled}
          placeholder="Поиск по имени или телефону"
          aria-label="Поиск участника"
          className="w-full rounded-xl border border-border bg-surface-elevated py-2.5 pl-10 pr-4 text-sm focus-ring disabled:opacity-60"
        />
      </div>

      <div className="scroll-x-contained shrink-0">
        <div
          className="flex gap-2 pb-1 scrollbar-none"
          role="tablist"
          aria-label="Фильтр по направлениям"
        >
          <button
            type="button"
            role="tab"
            aria-selected={directionFilter === 'all'}
            onClick={() => setDirectionFilter('all')}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-ring min-h-11 md:min-h-0',
              directionFilter === 'all'
                ? 'bg-brand-muted text-brand'
                : 'bg-surface-elevated text-text-secondary hover:text-text-primary',
            )}
          >
            Все
          </button>
          {directions.map((direction) => (
            <button
              key={direction.id}
              type="button"
              role="tab"
              aria-selected={directionFilter === direction.id}
              onClick={() => setDirectionFilter(direction.id)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-ring min-h-11 md:min-h-0',
                directionFilter === direction.id
                  ? 'bg-brand-muted text-brand'
                  : 'bg-surface-elevated text-text-secondary hover:text-text-primary',
              )}
            >
              {direction.icon ? `${direction.icon} ` : ''}
              {direction.name}
            </button>
          ))}
        </div>
      </div>

      {showSelectAll && (
        <div className="flex justify-end gap-1">
          {someFilteredSelected && (
            <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={clearFiltered}>
              Снять всех
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || allFilteredSelected}
            onClick={selectAllFiltered}
          >
            Выбрать всех ({filteredStudents.length})
          </Button>
        </div>
      )}

      <div className="popup-scroll min-h-0 flex-1 space-y-1">
        {filteredStudents.length > 0 ? (
          filteredStudents.map((student) => {
            const selected = selectedIds.includes(student.id);
            const directionLabel = formatStudentDirectionLabels(student, directions);
            return (
              <button
                key={student.id}
                type="button"
                disabled={disabled}
                onClick={() => toggleStudent(student.id)}
                className={cn(
                  'flex w-full min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors focus-ring',
                  selected ? 'bg-brand-muted text-brand' : 'hover:bg-surface-elevated',
                )}
              >
                <Avatar
                  src={student.avatarUrl}
                  firstName={student.firstName}
                  lastName={student.lastName}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{formatUserName(student)}</p>
                  {directionLabel && (
                    <p className="truncate text-caption text-text-muted">{directionLabel}</p>
                  )}
                </div>
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                    selected
                      ? 'border-brand bg-brand text-brand-contrast'
                      : 'border-border-subtle bg-surface',
                  )}
                  aria-hidden
                >
                  {selected && <Check className="h-4 w-4" />}
                </span>
              </button>
            );
          })
        ) : (
          <p className="py-8 text-center text-body-sm text-text-muted">{emptyMessage}</p>
        )}
      </div>
    </div>
  );
}
