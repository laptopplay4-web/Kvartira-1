import type { AttachmentType } from '@/types';
import {
  ALLOWED_AUDIO_MIMES,
  ALLOWED_DOCUMENT_MIMES,
  ALLOWED_IMAGE_MIMES,
  ALLOWED_VIDEO_MIMES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_AUDIO_SIZE,
  MAX_DOCUMENT_SIZE,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
  MESSAGE_MAX_LENGTH,
} from './constants';

export interface AttachmentValidationInput {
  filename: string;
  mimeType: string;
  size: number;
}

export type AttachmentValidationErrorCode =
  | 'TOO_MANY'
  | 'TOO_LARGE'
  | 'UNSUPPORTED_TYPE'
  | 'INVALID_FILENAME';

export interface AttachmentValidationError {
  code: AttachmentValidationErrorCode;
  message: string;
}

const EXTENSION_MAP: Record<AttachmentType, string[]> = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  file: ['pdf', 'doc', 'docx', 'txt'],
  audio: ['mp3', 'wav', 'ogg', 'm4a', 'webm'],
  video: ['mp4', 'webm', 'mov'],
};

function getExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? (parts.pop()?.toLowerCase() ?? '') : '';
}

export function detectAttachmentType(mimeType: string, filename: string): AttachmentType | null {
  const ext = getExtension(filename);
  if ((ALLOWED_IMAGE_MIMES as readonly string[]).includes(mimeType) || EXTENSION_MAP.image.includes(ext)) {
    return 'image';
  }
  if ((ALLOWED_DOCUMENT_MIMES as readonly string[]).includes(mimeType) || EXTENSION_MAP.file.includes(ext)) {
    return 'file';
  }
  if ((ALLOWED_AUDIO_MIMES as readonly string[]).includes(mimeType) || EXTENSION_MAP.audio.includes(ext)) {
    return 'audio';
  }
  if ((ALLOWED_VIDEO_MIMES as readonly string[]).includes(mimeType) || EXTENSION_MAP.video.includes(ext)) {
    return 'video';
  }
  return null;
}

function maxSizeForType(type: AttachmentType): number {
  switch (type) {
    case 'image':
      return MAX_IMAGE_SIZE;
    case 'file':
      return MAX_DOCUMENT_SIZE;
    case 'audio':
      return MAX_AUDIO_SIZE;
    case 'video':
      return MAX_VIDEO_SIZE;
  }
}

export function validateAttachment(input: AttachmentValidationInput): AttachmentValidationError | null {
  if (!input.filename.trim()) {
    return { code: 'INVALID_FILENAME', message: 'Не удалось загрузить файл' };
  }

  const type = detectAttachmentType(input.mimeType, input.filename);
  if (!type) {
    return { code: 'UNSUPPORTED_TYPE', message: 'Тип файла не поддерживается' };
  }

  const maxSize = maxSizeForType(type);
  if (input.size > maxSize) {
    return { code: 'TOO_LARGE', message: 'Файл слишком большой' };
  }

  return null;
}

export function validateAttachments(
  attachments: AttachmentValidationInput[],
): AttachmentValidationError | null {
  if (attachments.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    return { code: 'TOO_MANY', message: `Максимум ${MAX_ATTACHMENTS_PER_MESSAGE} вложений` };
  }
  for (const att of attachments) {
    const err = validateAttachment(att);
    if (err) return err;
  }
  return null;
}

export function validateMessageContent(
  text: string,
  attachmentCount: number,
): { valid: boolean; error?: string } {
  const trimmed = text.trim();
  if (trimmed.length === 0 && attachmentCount === 0) {
    return { valid: false, error: 'Сообщение не может быть пустым' };
  }
  if (trimmed.length > MESSAGE_MAX_LENGTH) {
    return { valid: false, error: `Максимум ${MESSAGE_MAX_LENGTH} символов` };
  }
  return { valid: true };
}
