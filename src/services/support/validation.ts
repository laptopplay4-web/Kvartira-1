import { ApiError } from '@/services/api/types';
import type { CreateSupportTicketInput } from '@/services/api/types';
import { MAX_ATTACHMENTS_PER_TICKET } from '@/services/support/constants';
import { validateAttachment, type AttachmentValidationInput } from '@/services/chat/validation';

const MAX_SUBJECT_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 2000;
const MIN_MESSAGE_LENGTH = 10;

export function validateSupportAttachment(
  input: AttachmentValidationInput,
): { valid: true } | { valid: false; message: string } {
  const err = validateAttachment(input);
  if (err) return { valid: false, message: err.message };
  return { valid: true };
}

export function validateCreateTicketInput(input: CreateSupportTicketInput): void {
  const subject = input.subject.trim();
  const message = input.message.trim();

  if (!subject) {
    throw new ApiError('Укажите тему обращения', 'VALIDATION', 400);
  }
  if (subject.length > MAX_SUBJECT_LENGTH) {
    throw new ApiError(`Тема не длиннее ${MAX_SUBJECT_LENGTH} символов`, 'VALIDATION', 400);
  }
  if (message.length < MIN_MESSAGE_LENGTH) {
    throw new ApiError(`Сообщение не короче ${MIN_MESSAGE_LENGTH} символов`, 'VALIDATION', 400);
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new ApiError(`Сообщение не длиннее ${MAX_MESSAGE_LENGTH} символов`, 'VALIDATION', 400);
  }
  if ((input.attachments?.length ?? 0) > MAX_ATTACHMENTS_PER_TICKET) {
    throw new ApiError(`Максимум ${MAX_ATTACHMENTS_PER_TICKET} вложения`, 'VALIDATION', 400);
  }
}

export function validateReplyInput(text: string): void {
  const trimmed = text.trim();
  if (trimmed.length < MIN_MESSAGE_LENGTH) {
    throw new ApiError(`Ответ не короче ${MIN_MESSAGE_LENGTH} символов`, 'VALIDATION', 400);
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new ApiError(`Ответ не длиннее ${MAX_MESSAGE_LENGTH} символов`, 'VALIDATION', 400);
  }
}

const MIN_FAQ_QUESTION_LENGTH = 5;
const MAX_FAQ_QUESTION_LENGTH = 200;
const MIN_FAQ_ANSWER_LENGTH = 10;
const MAX_FAQ_ANSWER_LENGTH = 4000;

export function validateFaqArticleInput(input: {
  question: string;
  answer: string;
}): void {
  const question = input.question.trim();
  const answer = input.answer.trim();

  if (question.length < MIN_FAQ_QUESTION_LENGTH) {
    throw new ApiError(`Вопрос не короче ${MIN_FAQ_QUESTION_LENGTH} символов`, 'VALIDATION', 400);
  }
  if (question.length > MAX_FAQ_QUESTION_LENGTH) {
    throw new ApiError(`Вопрос не длиннее ${MAX_FAQ_QUESTION_LENGTH} символов`, 'VALIDATION', 400);
  }
  if (answer.length < MIN_FAQ_ANSWER_LENGTH) {
    throw new ApiError(`Ответ не короче ${MIN_FAQ_ANSWER_LENGTH} символов`, 'VALIDATION', 400);
  }
  if (answer.length > MAX_FAQ_ANSWER_LENGTH) {
    throw new ApiError(`Ответ не длиннее ${MAX_FAQ_ANSWER_LENGTH} символов`, 'VALIDATION', 400);
  }
}
