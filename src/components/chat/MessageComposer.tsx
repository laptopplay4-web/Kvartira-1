import { useRef, useState } from 'react';
import { Send, WifiOff, Paperclip, Plus, Camera } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { MESSAGE_MAX_LENGTH } from '@/services/chat/constants';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { ComposerReplyPreview } from './ReplyPreview';
import { AttachmentPreview } from './AttachmentPreview';
import { VoiceRecorder } from './VoiceRecorder';
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
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const isOnline = useOnlineStatus();
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [attachError, setAttachError] = useState('');
  const [voiceActive, setVoiceActive] = useState(false);

  const isEditing = !!editingMessage;
  const text = draft;
  const hasText = text.trim().length > 0;
  const hasAttachments = pendingAttachments.some((a) => a.attachment && !a.error);
  const hasContent = hasText || hasAttachments;
  const canSend =
    hasContent &&
    text.trim().length <= MESSAGE_MAX_LENGTH &&
    !disabled &&
    isOnline &&
    !pendingAttachments.some((a) => a.uploading);
  const showMic = !isEditing && !hasText && !hasAttachments;

  const handleSend = () => {
    if (!canSend || sendingRef.current) return;
    // Optimistic sends may run in parallel; only block while an edit save is in flight.
    if (isEditing && isSending) return;
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
          mimeType: file.type || local.mimeType,
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

  const handleVoiceRecorded = async (file: File) => {
    if (!conversationId || !userId || !isOnline || disabled) return;
    setAttachError('');
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
        mimeType: file.type || 'audio/webm',
        size: file.size,
        dataUrl,
        kind: 'voice',
      });
      onSend({ text: '', attachments: [{ ...uploaded, kind: 'voice' }] });
      onClearDraft();
      onCancelReply?.();
    } catch {
      setAttachError('Не удалось отправить голосовое');
    }
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
        className="mx-auto flex min-w-0 max-w-2xl items-end gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        {!isEditing && !voiceActive && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
              aria-hidden
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
              aria-hidden
            />
            <IconButton
              label="Прикрепить файл"
              disabled={!isOnline || disabled}
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[44px] min-w-[44px] shrink-0"
            >
              <Paperclip className="h-4 w-4" aria-hidden />
            </IconButton>
            <IconButton
              label="Камера"
              disabled={!isOnline || disabled}
              onClick={() => cameraInputRef.current?.click()}
              className="min-h-[44px] min-w-[44px] shrink-0"
            >
              <Camera className="h-4 w-4" aria-hidden />
            </IconButton>
          </>
        )}

        {!voiceActive && (
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
            placeholder={isEditing ? 'Измените сообщение…' : 'Сообщение'}
            rows={1}
            aria-label="Текст сообщения"
            disabled={disabled || !isOnline}
            className="max-h-32 min-h-[44px] min-w-0 flex-1 resize-none rounded-2xl border border-border bg-surface-elevated px-4 py-2.5 text-sm leading-relaxed focus-ring"
          />
        )}

        {showMic ? (
          <VoiceRecorder
            disabled={!isOnline || disabled}
            onRecorded={(file) => {
              void handleVoiceRecorded(file);
            }}
            onError={setAttachError}
            onActiveChange={setVoiceActive}
          />
        ) : (
          <IconButton
            type="submit"
            label={isEditing ? 'Сохранить' : 'Отправить сообщение'}
            variant="tonal"
            disabled={!canSend}
            loading={isEditing && isSending}
            className="min-h-[44px] min-w-[44px] shrink-0"
          >
            {isEditing ? (
              <Plus className="h-4 w-4 rotate-45" aria-hidden />
            ) : (
              <Send className="h-4 w-4" aria-hidden />
            )}
          </IconButton>
        )}
      </form>

      {draft.length > MESSAGE_MAX_LENGTH * 0.9 && (
        <p className="mt-1 text-right text-caption text-text-muted">
          {draft.length}/{MESSAGE_MAX_LENGTH}
        </p>
      )}
    </div>
  );
}
