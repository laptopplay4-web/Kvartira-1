import { ClientResponseError } from 'pocketbase';
import { ApiError } from '@/services/api/types';

const PB_MESSAGE_MAP: Record<string, { message: string; code: string }> = {
  'Invalid login credentials.': {
    message: 'Неверный телефон или пароль',
    code: 'INVALID_CREDENTIALS',
  },
  'Failed to authenticate.': {
    message: 'Неверный телефон или пароль',
    code: 'INVALID_CREDENTIALS',
  },
  'The provided old password is invalid.': {
    message: 'Неверный текущий пароль',
    code: 'INVALID_CREDENTIALS',
  },
  'The provided old password is invalid or the user does not have a password set.': {
    message: 'Неверный текущий пароль',
    code: 'INVALID_CREDENTIALS',
  },
  'Something went wrong while processing your request.': {
    message: 'Не удалось выполнить запрос. Если проблема повторяется — примените миграции PocketBase и перезапустите сервер.',
    code: 'SERVER_ERROR',
  },
  "The requested resource wasn't found.": {
    message:
      'Маршрут не найден. Для YCLIENTS перезапустите PocketBase с актуальными pb_hooks (yclients.pb.js).',
    code: 'NOT_FOUND',
  },
  'Failed to delete record. Make sure that the record is not part of a required relation reference.': {
    message:
      'Не удалось удалить: есть связанные записи. Обновите приложение (cascade purge) или примените миграции PocketBase и перезапустите сервер.',
    code: 'CONFLICT',
  },
};

const PB_FIELD_MESSAGE_MAP: Record<string, string> = {
  'Must be at least 8 character(s).': 'Минимум 8 символов',
  'Must be at least 8 characters.': 'Минимум 8 символов',
  'Must be a valid url.': 'Не удалось сохранить иконку. Примените миграции PocketBase и перезапустите сервер',
  'Must be a valid URL.': 'Не удалось сохранить иконку. Примените миграции PocketBase и перезапустите сервер',
  'Must be at most 5000 character(s).': 'Изображение слишком большое',
  'The length must be no more than 5000.': 'Изображение слишком большое',
  'invalid purpose': 'Недопустимый тип файла. Примените миграции PocketBase (purpose event) и перезапустите сервер',
  'invalid value event.':
    'Сервер не настроен для фото мероприятий — примените миграции PocketBase и перезапустите serve',
  'Invalid value event.':
    'Сервер не настроен для фото мероприятий — примените миграции PocketBase и перезапустите serve',
};

function extractPbFieldError(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  for (const field of Object.values(data as Record<string, unknown>)) {
    if (!field || typeof field !== 'object') continue;
    const message = (field as { message?: unknown }).message;
    if (typeof message !== 'string' || !message) continue;
    return PB_FIELD_MESSAGE_MAP[message] ?? message;
  }
  return null;
}

export function mapPocketBaseError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof ClientResponseError) {
    const rawMessage =
      typeof error.response?.message === 'string'
        ? error.response.message
        : error.message;
    const mapped = PB_MESSAGE_MAP[rawMessage];
    if (mapped) {
      return new ApiError(mapped.message, mapped.code, error.status);
    }

    if (error.status === 401) {
      return new ApiError('Неверный телефон или пароль', 'INVALID_CREDENTIALS', 401);
    }
    if (error.status === 404) {
      const url = String((error as { url?: string }).url || error.originalError || '');
      if (url.includes('yclients') || rawMessage.toLowerCase().includes('not found')) {
        return new ApiError(
          'Маршрут YCLIENTS не найден — перезапустите PocketBase с актуальными pb_hooks (yclients.pb.js).',
          'NOT_FOUND',
          404,
        );
      }
      return new ApiError('Не найдено', 'NOT_FOUND', 404);
    }
    if (error.status === 403) {
      return new ApiError('Нет доступа', 'FORBIDDEN', 403);
    }
    if (error.status === 409) {
      if (rawMessage.includes('Мест больше нет') || rawMessage.includes('EVENT_FULL')) {
        return new ApiError('Мест больше нет', 'FULL', 409);
      }
      if (rawMessage.includes('idx_lessons_teacher_slot')) {
        return new ApiError(
          'Этот слот уже занят. Выберите другое время.',
          'SLOT_CONFLICT',
          409,
        );
      }
      return new ApiError(rawMessage || 'Конфликт данных', 'DUPLICATE', 409);
    }
    if (error.status === 400) {
      const fieldError = extractPbFieldError(error.response?.data);
      if (fieldError) {
        return new ApiError(fieldError, 'VALIDATION', 400);
      }
      return new ApiError(rawMessage || 'Ошибка валидации', 'VALIDATION', 400);
    }

    return new ApiError(rawMessage || 'Ошибка сервера', 'SERVER_ERROR', error.status);
  }

  if (error instanceof Error) {
    return new ApiError(error.message, 'UNKNOWN', 500);
  }

  return new ApiError('Неизвестная ошибка', 'UNKNOWN', 500);
}

export async function withPbError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw mapPocketBaseError(error);
  }
}
