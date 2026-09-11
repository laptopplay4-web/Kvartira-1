const NAME_MIN_LENGTH = 2;

export interface UpdateProfileFields {
  firstName?: string;
  lastName?: string;
  directionIds?: string[];
}

export function validateUpdateProfileInput(data: UpdateProfileFields): string | null {
  const hasFirstName = data.firstName !== undefined;
  const hasLastName = data.lastName !== undefined;
  const hasDirectionIds = data.directionIds !== undefined;

  if (!hasFirstName && !hasLastName && !hasDirectionIds) {
    return 'Укажите данные для сохранения';
  }

  if (hasFirstName && data.firstName!.trim().length < NAME_MIN_LENGTH) {
    return 'Имя — минимум 2 символа';
  }

  if (hasLastName && data.lastName!.trim().length < NAME_MIN_LENGTH) {
    return 'Фамилия — минимум 2 символа';
  }

  return null;
}
