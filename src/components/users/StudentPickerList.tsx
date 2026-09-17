import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn, formatUserName } from '@/utils';
import type { Direction, User } from '@/types';
import {
  filterStudentsByDirection,
  formatStudentDirectionLabels,
  type GroupMemberDirectionFilter,
} from '@/services/assignments/groups/helpers';
import { dedupeUsersById, filterUsersBySearchQuery, sortUsersByRoleAndName } from '@/services/users/helpers';
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
  searchPlaceholder?: string;
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
  searchPlaceholder = 'Поиск по имени или телефону',
}: StudentPickerListProps) {
  const [directionFilter, setDirectionFilter] = useState<GroupMemberDirectionFilter>('all');
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const panelId = useId();
  const directionsRef = useRef<HTMLDivElement>(null);

  const uniqueStudents = useMemo(() => dedupeUsersById(students), [students]);

  const filteredStudents = useMemo(() => {
    const byDirection = filterStudentsByDirection(uniqueStudents, directionFilter);
    const byQuery = filterUsersBySearchQuery(byDirection, query);
    return sortUsersByRoleAndName(byQuery);
  }, [uniqueStudents, directionFilter, query]);

  const selectedDirection = useMemo(
    () =>
      directionFilter === 'all'
        ? undefined
        : directions.find((direction) => direction.id === directionFilter),
    [directionFilter, directions],
  );

  useEffect(() => {
    if (directionFilter === 'all') return;
    if (!directions.some((direction) => direction.id === directionFilter)) {
      setDirectionFilter('all');
    }
  }, [directionFilter, directions]);

  useEffect(() => {
    if (!directionsOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && directionsRef.current?.contains(target)) return;
      setDirectionsOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [directionsOpen]);

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
    uniqueStudents.length === 0
      ? emptyAllLabel
      : query.trim()
        ? 'Ничего не найдено'
        : emptyFilterLabel;

  const directionsActive = directionFilter !== 'all';
  const directionsLabel = selectedDirection
    ? `${selectedDirection.icon ? `${selectedDirection.icon} ` : ''}${selectedDirection.name}`
    : 'Направления';

  const selectAllMode = () => {
    setDirectionFilter('all');
    setDirectionsOpen(false);
  };

  const pickDirection = (directionId: string) => {
    setDirectionFilter(directionId);
    setDirectionsOpen(false);
  };

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
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="w-full rounded-xl border border-border bg-surface-elevated py-2.5 pl-10 pr-4 text-sm focus-ring disabled:opacity-60"
        />
      </div>

      <div ref={directionsRef} className="relative shrink-0">
        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="Фильтр по направлениям"
        >
          <button
            type="button"
            role="tab"
            aria-selected={!directionsActive}
            disabled={disabled}
            onClick={selectAllMode}
            className={cn(
              'min-h-11 shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-ring md:min-h-0',
              !directionsActive
                ? 'bg-brand-muted text-brand'
                : 'bg-surface-elevated text-text-secondary hover:text-text-primary',
            )}
          >
            Все
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={directionsActive}
            aria-expanded={directionsOpen}
            aria-controls={panelId}
            disabled={disabled || directions.length === 0}
            onClick={() => setDirectionsOpen((open) => !open)}
            className={cn(
              'inline-flex min-h-11 max-w-full shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-ring md:min-h-0',
              directionsActive
                ? 'bg-brand-muted text-brand'
                : 'bg-surface-elevated text-text-secondary hover:text-text-primary',
              directions.length === 0 && 'opacity-50',
            )}
          >
            <span className="min-w-0 truncate">{directionsLabel}</span>
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 transition-transform duration-[var(--duration-fast)]',
                directionsOpen && 'rotate-180',
              )}
              aria-hidden
            />
          </button>
        </div>

        <div
          id={panelId}
          role="listbox"
          aria-label="Направления"
          aria-hidden={!directionsOpen}
          className={cn(
            'origin-top overflow-hidden transition-[grid-template-rows,opacity] duration-[var(--duration-normal)] ease-out',
            directionsOpen
              ? 'mt-2 grid grid-rows-[1fr] opacity-100'
              : 'pointer-events-none grid grid-rows-[0fr] opacity-0',
          )}
        >
          <div className="min-h-0">
            <div className="popup-scroll max-h-48 space-y-0.5 rounded-xl border border-border bg-surface-elevated p-1.5 shadow-sm">
              {directions.map((direction) => {
                const selected = directionFilter === direction.id;
                return (
                  <button
                    key={direction.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={disabled}
                    onClick={() => pickDirection(direction.id)}
                    className={cn(
                      'flex w-full min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-ring',
                      selected
                        ? 'bg-brand-muted font-medium text-brand'
                        : 'text-text-primary hover:bg-surface-hover',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {direction.icon ? `${direction.icon} ` : ''}
                      {direction.name}
                    </span>
                    {selected && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                  </button>
                );
              })}
              {directions.length === 0 && (
                <p className="px-3 py-3 text-center text-caption text-text-muted">
                  Нет направлений
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {showSelectAll && (
        <div className="flex shrink-0 justify-end gap-1">
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

      <div className="popup-scroll min-h-0 max-h-[min(16rem,45dvh)] flex-1 space-y-1">
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
