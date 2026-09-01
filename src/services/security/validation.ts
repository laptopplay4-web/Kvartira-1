import { MIN_PASSWORD_LENGTH } from './constants';

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function validateChangePasswordInput(
  input: ChangePasswordInput,
): string | null {
  if (!input.currentPassword.trim()) {
    return 'Введите текущий пароль';
  }
  if (input.newPassword.length < MIN_PASSWORD_LENGTH) {
    return `Новый пароль — минимум ${MIN_PASSWORD_LENGTH} символов`;
  }
  if (input.newPassword !== input.confirmPassword) {
    return 'Пароли не совпадают';
  }
  if (input.currentPassword === input.newPassword) {
    return 'Новый пароль должен отличаться от текущего';
  }
  return null;
}
