import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import type { Message, MessageReportReason } from '@/types';
import {
  MESSAGE_REPORT_REASON_LABELS,
  buildReportTicketMessage,
  buildReportTicketSubject,
  validateReportMessageInput,
} from '@/services/support/reportMessage';

const REASONS = Object.entries(MESSAGE_REPORT_REASON_LABELS) as [MessageReportReason, string][];

interface ReportMessageModalProps {
  open: boolean;
  onClose: () => void;
  message: Message;
  conversationId: string;
  userId: string;
  onSubmitted?: () => void;
}

export function ReportMessageModal({
  open,
  onClose,
  message,
  conversationId,
  userId,
  onSubmitted,
}: ReportMessageModalProps) {
  const isOnline = useOnlineStatus();
  const [reason, setReason] = useState<MessageReportReason>('image_rights');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      validateReportMessageInput({
        reason,
        details,
        conversationId,
        messageId: message.id,
      });
      return api.support.createTicket(
        {
          subject: buildReportTicketSubject(reason),
          message: buildReportTicketMessage(reason, details, {
            conversationId,
            messageId: message.id,
          }),
          category: 'chat',
          reportContext: {
            conversationId,
            messageId: message.id,
            reason,
          },
        },
        userId,
      );
    },
    onSuccess: () => {
      setError('');
      setDetails('');
      setReason('image_rights');
      onSubmitted?.();
      onClose();
    },
    onError: (e) => {
      setError(e instanceof ApiError ? e.message : 'Не удалось отправить жалобу');
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Пожаловаться"
      size="md"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={onClose} disabled={mutation.isPending}>
            Отмена
          </Button>
          <Button
            fullWidth
            loading={mutation.isPending}
            disabled={!isOnline}
            onClick={() => {
              if (!isOnline) return;
              setError('');
              mutation.mutate();
            }}
          >
            Отправить
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {!isOnline && (
          <p className="text-body-sm text-warning" role="status">
            {OFFLINE_NETWORK_MESSAGE}
          </p>
        )}
        <fieldset className="space-y-2">
          <legend className="text-label text-text-secondary">Причина</legend>
          {REASONS.map(([value, label]) => (
            <label key={value} className="flex min-h-11 items-center gap-3 text-body-sm">
              <input
                type="radio"
                name="report-reason"
                className="h-4 w-4 border-border-subtle text-brand focus-ring"
                checked={reason === value}
                onChange={() => setReason(value)}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <div>
          <label htmlFor="report-details" className="mb-1 block text-caption text-text-muted">
            Комментарий (необязательно)
          </label>
          <textarea
            id="report-details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={3}
            maxLength={2000}
            disabled={!isOnline || mutation.isPending}
            className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-body-sm focus-ring"
            placeholder="Кратко опишите ситуацию…"
          />
        </div>
        {error && (
          <p className="text-body-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
