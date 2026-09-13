import { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { formatUserName } from '@/utils';
import type { User } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { rolePromoteButtonClassName } from '@/components/admin/roleActionButtons';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { filterUsersBySearchQuery } from '@/services/users/helpers';

interface PromoteToTeacherModalProps {
  open: boolean;
  onClose: () => void;
  students: User[];
  onPromote: (userId: string) => void;
  promotingUserId?: string | null;
  disabled?: boolean;
}

export function PromoteToTeacherModal({
  open,
  onClose,
  students,
  onPromote,
  promotingUserId,
  disabled,
}: PromoteToTeacherModalProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const visibleStudents = useMemo(() => {
    const filtered = filterUsersBySearchQuery(students, query);
    return [...filtered].sort((a, b) => formatUserName(a).localeCompare(formatUserName(b), 'ru'));
  }, [students, query]);

  const hasStudents = students.length > 0;
  const hasMatches = visibleStudents.length > 0;

  return (
    <Modal open={open} onClose={onClose} title="Назначить преподавателя" size="lg">
      <div className="flex flex-col gap-3">
        <p className="text-body-sm text-text-secondary">
          Выберите ученика для назначения преподавателем.
        </p>

        {hasStudents && (
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по имени или телефону"
              aria-label="Поиск ученика"
              className="w-full rounded-xl border border-border bg-surface-elevated py-2.5 pl-10 pr-4 text-sm focus-ring"
            />
          </div>
        )}

        <div className="space-y-1">
          {hasMatches ? (
            visibleStudents.map((student) => {
              const isPromoting = promotingUserId === student.id;
              return (
                <div
                  key={student.id}
                  className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-elevated"
                >
                  <Avatar
                    src={student.avatarUrl}
                    firstName={student.firstName}
                    lastName={student.lastName}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{formatUserName(student)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={rolePromoteButtonClassName}
                    loading={isPromoting}
                    disabled={disabled || (promotingUserId != null && !isPromoting)}
                    onClick={() => onPromote(student.id)}
                    aria-label={`Назначить преподавателем: ${formatUserName(student)}`}
                  >
                    {!isPromoting && <Plus className="h-4 w-4" aria-hidden />}
                  </Button>
                </div>
              );
            })
          ) : (
            <p className="py-8 text-center text-body-sm text-text-muted">
              {hasStudents ? 'Ничего не найдено' : 'Нет учеников для назначения'}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
