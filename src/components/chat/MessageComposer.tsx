import { useRef, useState } from 'react';
import { Send, WifiOff, Paperclip, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { MESSAGE_MAX_LENGTH } from '@/services/chat/constants';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { ComposerReplyPreview } from './ReplyPreview';
import { AttachmentPreview } from './AttachmentPreview';
import { validateAttachment } from '@/services/chat/validation';
import { createAttachmentFromFile } from '@/services/chat/attachments';
import type { Message, MessageAttachment, User } from '@/types';
import { notifyTyping } from '@/hooks/useTypingIndicator';

export interface PendingAttachment {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  previewUrl?: string;
  attachment?: MessageAttachment;
  uploading?: boolean;
  error?: string;
}

export interface SendPayload {
  text: string;
  replyToMessageId?: string;
  attachments?: MessageAttachment[];
}

interface MessageComposerProps {
  conversationId?: string;
  userId?: string;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: (payload: SendPayload) => void;
  onClearDraft: () => void;
  disabled?: boolean;
  isSending?: boolean;
  replyTo?: Message | null;
  users?: User[];
  onCancelReply?: () => void;
  editingMessage?: Message | null;
  onCancelEdit?: () => void;
  onSaveEdit?: (text: string) => void;
}

export function MessageComposer({
  conversationId,
  userId,
  draft,
  onDraftChange,
  onSend,
  onClearDraft,
  disabled,
  isSending,
  replyTo,
  users = [],
  onCancelReply,
  editingMessage,
  onCancelEdit,
  onSaveEdit,
}: MessageComposerProps) {
  const sendingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isOnline = useOnlineStatus();
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [attachError, setAttachError] = useState('');

  const isEditing = !!editingMessage;
  const text = isEditing ? draft : draft;
  const hasContent = text.trim().length > 0 || pendingAttachments.some((a) => a.attachment && !a.error);
  const canSend =
    hasContent &&
    text.trim().length <= MESSAGE_MAX_LENGTH &&
    !disabled &&
    isOnline &&
    !pendingAttachments.some((a) => a.uploading);

  const handleSend = () => {
    if (!canSend || sendingRef.current || isSending) return;
    sendingRef.current = true;

    if (isEditing && onSaveEdit) {
      onSaveEdit(text.trim());
      sendingRef.current = false;
      return;
    }

    const attachments = pendingAttachments
      .filter((a) => a.attachment && !a.error)
      .map((a) => a.attachment!);

    onSend({
      text: text.trim(),
      replyToMessageId: replyTo?.id,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
    onClearDraft();
    setPendingAttachments([]);
    setAttachError('');
    onCancelReply?.();
    queueMicrotask(() => {
      sendingRef.current = false;
    });
  };

  const handleFiles = async (files: FileList | File[]) => {
    if (!conversationId || !userId) return;
    setAttachError('');
    const list = Array.from(files);

    for (const file of list) {
      const err = validateAttachment({ filename: file.name, mimeType: file.type, size: file.size });
      if (err) {
        setAttachError(err.message);
        continue;
      }

      const id = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const local = createAttachmentFromFile(file, id);
      if (!local) {
        setAttachError('Тип файла не поддерживается');
        continue;
      }

      setPendingAttachments((prev) => [
        ...prev,
        {
          id,
          filename: file.name,
          size: file.size,
          mimeType: file.type,
          previewUrl: local.type === 'image' ? local.url : undefined,
          uploading: true,
        },
      ]);

      try {
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const { api } = await import('@/services/api');
        const uploaded = await api.chat.uploadAttachment(conversationId, userId, {
          filename: file.name,
          mimeType: file.type,
          size: file.size,
          dataUrl,
        });

        setPendingAttachments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, attachment: uploaded, uploading: false } : a)),
        );
      } catch {
        setPendingAttachments((prev) =>
          prev.map((a) =>
            a.id === id ? { ...a, uploading: false, error: 'Не удалось загрузить файл' } : a,
          ),
        );
      }
    }
  };

  const removeAttachment = (id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="shrink-0 border-t border-border-subtle bg-surface p-3 pb-[max(0.75rem,var(--spacing-safe-bottom))] md:p-4 md:pb-4">
      {!isOnline && (
        <p className="mb-2 flex items-center gap-2 text-caption text-warning">
          <WifiOff className="h-3.5 w-3.5" aria-hidden />
          Нет подключения. Сообщения нельзя отправить в offline режиме.
        </p>
      )}

      {isEditing && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-brand-muted px-3 py-1.5">
          <span className="text-caption text-brand">Редактирование сообщения</span>
          <Button variant="ghost" size="sm" onClick={onCancelEdit}>
            Отмена
          </Button>
        </div>
      )}

      <ComposerReplyPreview replyTo={replyTo ?? null} users={users} onCancel={onCancelReply ?? (() => {})} />

      <AttachmentPreview attachments={pendingAttachments} onRemove={removeAttachment} />
      {attachError && <p className="mb-2 text-caption text-danger">{attachError}</p>}

      <form
        className="mx-auto flex min-w-0 max-w-2xl gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        {!isEditing && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
              aria-hidden
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={!isOnline || disabled}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Прикрепить файл"
              className="min-h-[44px] min-w-[44px] shrink-0"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
          </>
        )}

        <textarea
          value={draft}
          onChange={(e) => {
            const val = e.target.value.slice(0, MESSAGE_MAX_LENGTH);
            onDraftChange(val);
            if (conversationId && userId) notifyTyping(conversationId, userId);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
            if (e.key === 'Escape' && isEditing) onCancelEdit?.();
          }}
          placeholder={isEditing ? 'Измените сообщение…' : 'Написать сообщение...'}
          rows={1}
          aria-label="Текст сообщения"
          disabled={disabled || !isOnline}
          className="max-h-32 min-h-[44px] min-w-0 flex-1 resize-none rounded-xl border border-border bg-surface-elevated px-4 py-2.5 text-sm leading-relaxed focus-ring"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!canSend}
          loading={isSending}
          aria-label={isEditing ? 'Сохранить' : 'Отправить сообщение'}
          className="min-h-[44px] min-w-[44px] shrink-0"
        >
          {isEditing ? <Plus className="h-4 w-4 rotate-45" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>

      {draft.length > MESSAGE_MAX_LENGTH * 0.9 && (
        <p className="mt-1 text-right text-caption text-text-muted">
          {draft.length}/{MESSAGE_MAX_LENGTH}
        </p>
      )}
    </div>
  );
}
