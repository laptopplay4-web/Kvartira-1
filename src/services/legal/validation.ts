import { ApiError } from '@/services/api/types';
import type { PublishLegalVersionInput, UpdateLegalDocumentInput } from '@/services/api/types';

const MIN_TITLE_LENGTH = 3;
const MAX_TITLE_LENGTH = 200;
const MIN_CONTENT_LENGTH = 10;
const MAX_CONTENT_LENGTH = 50_000;
const MIN_CHANGE_SUMMARY_LENGTH = 5;
const MAX_CHANGE_SUMMARY_LENGTH = 500;
const VERSION_PATTERN = /^\d+\.\d+$/;

export function validateUpdateLegalDocumentInput(input: UpdateLegalDocumentInput): void {
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (title.length < MIN_TITLE_LENGTH) {
      throw new ApiError(`Название не короче ${MIN_TITLE_LENGTH} символов`, 'VALIDATION', 400);
    }
    if (title.length > MAX_TITLE_LENGTH) {
      throw new ApiError(`Название не длиннее ${MAX_TITLE_LENGTH} символов`, 'VALIDATION', 400);
    }
  }

  if (input.content !== undefined) {
    const content = input.content.trim();
    if (content.length < MIN_CONTENT_LENGTH) {
      throw new ApiError(`Текст не короче ${MIN_CONTENT_LENGTH} символов`, 'VALIDATION', 400);
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      throw new ApiError(`Текст не длиннее ${MAX_CONTENT_LENGTH} символов`, 'VALIDATION', 400);
    }
  }
}

export function validatePublishLegalVersionInput(input: PublishLegalVersionInput): void {
  const content = input.content.trim();
  const changeSummary = input.changeSummary.trim();

  if (content.length < MIN_CONTENT_LENGTH) {
    throw new ApiError(`Текст не короче ${MIN_CONTENT_LENGTH} символов`, 'VALIDATION', 400);
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    throw new ApiError(`Текст не длиннее ${MAX_CONTENT_LENGTH} символов`, 'VALIDATION', 400);
  }
  if (changeSummary.length < MIN_CHANGE_SUMMARY_LENGTH) {
    throw new ApiError(
      `Описание изменений не короче ${MIN_CHANGE_SUMMARY_LENGTH} символов`,
      'VALIDATION',
      400,
    );
  }
  if (changeSummary.length > MAX_CHANGE_SUMMARY_LENGTH) {
    throw new ApiError(
      `Описание изменений не длиннее ${MAX_CHANGE_SUMMARY_LENGTH} символов`,
      'VALIDATION',
      400,
    );
  }
  if (!input.effectiveAt.trim()) {
    throw new ApiError('Укажите дату вступления в силу', 'VALIDATION', 400);
  }
  if (input.version !== undefined && !VERSION_PATTERN.test(input.version.trim())) {
    throw new ApiError('Версия в формате X.Y', 'VALIDATION', 400);
  }
}
