import type { AttachmentType, MessageAttachment } from '@/types';
import { detectAttachmentType } from './validation';

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

/** Voice note: explicit kind, or legacy `voice-*` filenames from recorder. */
export function isVoiceAttachment(attachment: MessageAttachment): boolean {
  if (attachment.kind === 'voice') return true;
  if (attachment.kind === 'file') return false;
  return attachment.type === 'audio' && attachment.filename.startsWith('voice-');
}

const MEDIA_CAPTION_PLACEHOLDERS = new Set([
  'Вложение',
  'Фото',
  'Видео',
  'Голосовое',
  'Аудио',
  'Файл',
]);

/** Label for chat list / notifications when message has no user caption. */
export function getAttachmentPreviewLabel(attachment: MessageAttachment): string {
  if (attachment.type === 'image') return 'Фото';
  if (attachment.type === 'video') return 'Видео';
  if (isVoiceAttachment(attachment)) return 'Голосовое';
  if (attachment.type === 'audio') return attachment.filename || 'Аудио';
  return attachment.filename || 'Файл';
}

export function getAttachmentsPreviewLabel(attachments: MessageAttachment[] | undefined): string {
  if (!attachments?.length) return 'Вложение';
  if (attachments.length === 1) return getAttachmentPreviewLabel(attachments[0]!);
  return 'Вложение';
}

/**
 * True when `text` is only a synthetic stand-in for media (filename or placeholder),
 * not a real user caption — hide it under the attachment in the bubble.
 */
export function isSyntheticMediaCaption(
  text: string,
  attachments: MessageAttachment[] | undefined,
): boolean {
  const trimmed = text.trim();
  if (!trimmed || !attachments?.length) return false;
  if (MEDIA_CAPTION_PLACEHOLDERS.has(trimmed)) return true;
  return attachments.some((a) => a.filename === trimmed);
}

export function createAttachmentFromFile(file: File, id: string): MessageAttachment | null {
  const type = detectAttachmentType(file.type, file.name);
  if (!type) return null;
  return {
    id,
    type,
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    url: URL.createObjectURL(file),
  };
}

export function groupImages(attachments: MessageAttachment[]): MessageAttachment[][] {
  const images = attachments.filter((a) => a.type === 'image');
  const others = attachments.filter((a) => a.type !== 'image');
  const groups: MessageAttachment[][] = images.length > 0 ? [images] : [];
  for (const att of others) {
    groups.push([att]);
  }
  return groups;
}

export function getAttachmentIcon(type: AttachmentType): string {
  switch (type) {
    case 'image':
      return 'image';
    case 'file':
      return 'file';
    case 'audio':
      return 'audio';
    case 'video':
      return 'video';
  }
}
