import type { AssignmentContentType } from '@/types';
import { validateAttachment, type AttachmentValidationInput } from '@/services/chat/validation';
import { ASSIGNMENT_CONTENT_ACCEPT } from '@/services/assignments/constants';

export function validateAssignmentContentFile(
  input: AttachmentValidationInput,
  contentType: AssignmentContentType,
): { valid: true } | { valid: false; message: string } {
  if (contentType === 'text') {
    return { valid: false, message: 'Для текстового блока файл не нужен' };
  }

  const err = validateAttachment(input);
  if (err) return { valid: false, message: err.message };

  if (contentType === 'voice') {
    const isMp3 =
      input.mimeType === 'audio/mpeg' ||
      input.mimeType === 'audio/mp3' ||
      input.filename.toLowerCase().endsWith('.mp3');
    if (!isMp3) return { valid: false, message: 'Загрузите MP3-файл' };
  }

  if (contentType === 'pdf') {
    const isPdf =
      input.mimeType === 'application/pdf' || input.filename.toLowerCase().endsWith('.pdf');
    if (!isPdf) return { valid: false, message: 'Загрузите PDF-файл' };
  }

  if (contentType === 'video') {
    if (!input.mimeType.startsWith('video/')) {
      return { valid: false, message: 'Загрузите видеофайл' };
    }
  }

  return { valid: true };
}

export function getAcceptForContentType(type: AssignmentContentType): string | undefined {
  return ASSIGNMENT_CONTENT_ACCEPT[type];
}

export function validateContentBlock(
  type: AssignmentContentType,
  text?: string,
  file?: { filename: string; mimeType: string; size: number },
): { valid: true } | { valid: false; message: string } {
  if (type === 'text') {
    if (!text?.trim()) return { valid: false, message: 'Введите текст' };
    return { valid: true };
  }
  if (!file) return { valid: false, message: 'Загрузите файл' };
  return validateAssignmentContentFile(file, type);
}

export function validateGroupName(name: string): { valid: true } | { valid: false; message: string } {
  const trimmed = name.trim();
  if (trimmed.length < 2) return { valid: false, message: 'Название группы — минимум 2 символа' };
  if (trimmed.length > 80) return { valid: false, message: 'Название группы — максимум 80 символов' };
  return { valid: true };
}
