import type { AttachmentType, MessageAttachment } from '@/types';
import { detectAttachmentType } from './validation';

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

/**
 * Display name without extension (`song.mp3` → `song`).
 * Keeps full name if there is no extension or the stem would be empty (`.gitignore`).
 */
export function displayAttachmentFilename(filename: string | undefined | null): string {
  const raw = (filename ?? '').trim();
  if (!raw) return '';
  const lastDot = raw.lastIndexOf('.');
  if (lastDot <= 0) return raw;
  const stem = raw.slice(0, lastDot).trim();
  return stem || raw;
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
  if (attachment.type === 'audio') {
    return displayAttachmentFilename(attachment.filename) || 'Аудио';
  }
  return displayAttachmentFilename(attachment.filename) || 'Файл';
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
  return attachments.some((a) => {
    if (a.filename === trimmed) return true;
    const stem = displayAttachmentFilename(a.filename);
    return !!stem && stem === trimmed;
  });
}

/** Attachments that can be saved locally (have a resolvable URL). */
export function getDownloadableAttachments(
  attachments: MessageAttachment[] | undefined,
): MessageAttachment[] {
  if (!attachments?.length) return [];
  return attachments.filter(
    (a) =>
      !!a.url &&
      !a.url.startsWith('pbfile:') &&
      (a.type === 'image' || a.type === 'video' || a.type === 'audio' || a.type === 'file'),
  );
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
