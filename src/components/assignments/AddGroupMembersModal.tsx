import { useState } from 'react';
import type { Direction, User } from '@/types';
import { StudentPickerList } from '@/components/users/StudentPickerList';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface AddGroupMembersModalProps {
  open: boolean;
  onClose: () => void;
  students: User[];
  directions: Direction[];
  onAdd: (studentIds: string[]) => void | Promise<void>;
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

  const handleClose = () => {
    setSelectedIds([]);
    onClose();
  };

  const handleSubmit = async () => {
    if (selectedIds.length === 0) return;
    await onAdd(selectedIds);
    setSelectedIds([]);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Добавить участников"
      size="lg"
      footer={
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
      }
    >
      <StudentPickerList
        students={students}
        directions={directions}
        selectedIds={selectedIds}
        onChange={setSelectedIds}
        mode="multiple"
        disabled={disabled || loading}
        emptyAllLabel="Все ученики уже в группе"
      />
    </Modal>
  );
}
