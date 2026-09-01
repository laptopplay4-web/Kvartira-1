import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { cn, formatUserName } from '@/utils';
import type { Direction, User } from '@/types';
import {
  filterStudentsByDirection,
  formatStudentDirectionLabels,
  type GroupMemberDirectionFilter,
} from '@/services/assignments/groups/helpers';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';

interface AddGroupMembersModalProps {
  open: boolean;
  onClose: () => void;
  students: User[];
  directions: Direction[];
  onAdd: (studentIds: string[]) => Promise<void>;
  loading?: boolean;
  disabled?: boolean;
}

export function AddGroupMembersModal({
  open,
  onClose,
  students,
  directions,
  onAdd,
  loading,
  disabled,
}: AddGroupMembersModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [directionFilter, setDirectionFilter] = useState<GroupMemberDirectionFilter>('all');

  const filteredStudents = useMemo(
    () =>
      filterStudentsByDirection(students, directionFilter).sort((a, b) =>
        formatUserName(a).localeCompare(formatUserName(b), 'ru'),
      ),
    [students, directionFilter],
  );

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectAllFiltered = () => {
    const ids = filteredStudents.map((student) => student.id);
    setSelectedIds((prev) => [...new Set([...prev, ...ids])]);
  };

  const showSelectAll = directionFilter !== 'all' && filteredStudents.length > 0;
  const allFilteredSelected = filteredStudents.every((student) =>
    selectedIds.includes(student.id),
  );

  const handleClose = () => {
    setSelectedIds([]);
    setDirectionFilter('all');
    onClose();
  };

  const handleSubmit = async () => {
    if (selectedIds.length === 0) return;
    await onAdd(selectedIds);
    setSelectedIds([]);
    setDirectionFilter('all');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Добавить участников"
      className="max-h-[90vh] overflow-hidden sm:max-w-lg"
    >
      <div className="flex max-h-[70vh] flex-col gap-4">
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
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || loading || allFilteredSelected}
              onClick={selectAllFiltered}
            >
              Выбрать всех ({filteredStudents.length})
            </Button>
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {filteredStudents.length > 0 ? (
            filteredStudents.map((student) => {
              const selected = selectedIds.includes(student.id);
              const directionLabel = formatStudentDirectionLabels(student, directions);
              return (
                <button
                  key={student.id}
                  type="button"
                  disabled={disabled || loading}
                  onClick={() => toggleStudent(student.id)}
                  className={cn(
                    'flex w-full min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors focus-ring',
                    selected
                      ? 'bg-brand-muted text-brand'
                      : 'hover:bg-surface-elevated',
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
            <p className="py-8 text-center text-body-sm text-text-muted">
              {students.length === 0
                ? 'Все ученики уже в группе'
                : 'Нет учеников по выбранному направлению'}
            </p>
          )}
        </div>

        <Button
          type="button"
          fullWidth
          loading={loading}
          disabled={disabled || selectedIds.length === 0}
          onClick={() => void handleSubmit()}
        >
          Добавить участников
          {selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
        </Button>
      </div>
    </Modal>
  );
}
