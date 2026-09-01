import type { UpdateNotificationPreferencesInput } from '@/types';

export function validateNotificationPreferencesInput(
  input: UpdateNotificationPreferencesInput,
): string | null {
  if (input.pushEnabled === undefined) {
    return 'Нет данных для обновления';
  }

  return null;
}
