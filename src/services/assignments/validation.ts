import type { AssignmentResponseType } from '@/types';
import { detectAttachmentType, validateAttachment, type AttachmentValidationInput } from '@/services/chat/validation';

export function getAcceptForResponseType(type: AssignmentResponseType): string | undefined {
  switch (type) {
    case 'text':
      return undefined;
    case 'audio':
      return 'audio/*';
    case 'video':
      return 'video/*';
    case 'image':
      return 'image/*';
    case 'file':
      return '.pdf,.doc,.docx,.txt,application/pdf';
  }
}

export function responseTypeMatchesFile(
  responseType: AssignmentResponseType,
  mimeType: string,
  filename: string,
): boolean {
  if (responseType === 'text') return false;
  const detected = detectAttachmentType(mimeType, filename);
  if (!detected) return false;
  if (responseType === 'image') return detected === 'image';
  if (responseType === 'audio') return detected === 'audio';
  if (responseType === 'video') return detected === 'video';
  if (responseType === 'file') return detected === 'file';
  return false;
}

export function validateAssignmentMaterial(
  input: AttachmentValidationInput,
): { valid: true } | { valid: false; message: string } {
  const err = validateAttachment(input);
  if (err) return { valid: false, message: err.message };
  return { valid: true };
}

export function validateAssignmentResponseFile(
  input: AttachmentValidationInput,
  responseType: AssignmentResponseType,
): { valid: true } | { valid: false; message: string } {
  if (responseType === 'text') {
    return { valid: false, message: 'Для текстового задания файл не нужен' };
  }

  const err = validateAttachment(input);
  if (err) return { valid: false, message: err.message };

  if (!responseTypeMatchesFile(responseType, input.mimeType, input.filename)) {
    return { valid: false, message: 'Файл не соответствует типу ответа' };
  }

  return { valid: true };
}

export function validateAssignmentFeedbackAudio(
  input: AttachmentValidationInput,
): { valid: true } | { valid: false; message: string } {
  const err = validateAttachment(input);
  if (err) return { valid: false, message: err.message };

  if (!responseTypeMatchesFile('audio', input.mimeType, input.filename)) {
    return { valid: false, message: 'Загрузите аудиофайл' };
  }

  return { valid: true };
}
