import { validatePasswordResetPhone } from '@/services/auth/validation';

const NAME_MIN_LENGTH = 2;

export interface UpdateProfileFields {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export function validateUpdateProfileInput(data: UpdateProfileFields): string | null {
  const hasFirstName = data.firstName !== undefined;
  const hasLastName = data.lastName !== undefined;
  const hasPhone = data.phone !== undefined;

  if (!hasFirstName && !hasLastName && !hasPhone) {
    return 'Укажите данные для сохранения';
  }

  if (hasFirstName && data.firstName!.trim().length < NAME_MIN_LENGTH) {
    return 'Имя — минимум 2 символа';
  }

  if (hasLastName && data.lastName!.trim().length < NAME_MIN_LENGTH) {
    return 'Фамилия — минимум 2 символа';
  }

  if (hasPhone) {
    const phoneError = validatePasswordResetPhone(data.phone!);
    if (phoneError) return phoneError;
  }

  return null;
}
