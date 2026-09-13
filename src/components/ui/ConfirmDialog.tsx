import type { ReactNode } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** destructive = red confirm for delete actions */
  tone?: 'default' | 'destructive';
  loading?: boolean;
  disabled?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  tone = 'default',
  loading,
  disabled,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button
            variant={tone === 'destructive' ? 'destructive' : 'primary'}
            loading={loading}
            disabled={disabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
        </div>
      }
    >
      <div className="min-w-0 break-words text-body-sm text-text-secondary [overflow-wrap:anywhere]">
        {description}
      </div>
    </Modal>
  );
}
