import {
  MOCK_PASSWORD_RESET_CODE,
  PASSWORD_RESET_CODE_LENGTH,
  PASSWORD_RESET_MIN_LENGTH,
} from './constants';

const PHONE_REGEX = /^\+79\d{9}$/;

export function validatePasswordResetPhone(phone: string): string | null {
  if (!phone.trim()) return 'Введите номер телефона';
  if (!PHONE_REGEX.test(phone)) return 'Формат: +79XXXXXXXXX';
  return null;
}

export function validatePasswordResetCode(code: string): string | null {
  const trimmed = code.trim();
  if (!trimmed) return 'Введите код из SMS';
  if (!/^\d+$/.test(trimmed)) return 'Код должен содержать только цифры';
  if (trimmed.length !== PASSWORD_RESET_CODE_LENGTH) {
    return `Код — ${PASSWORD_RESET_CODE_LENGTH} цифр`;
  }
  return null;
}

export function validatePasswordResetNewPassword(
  newPassword: string,
  confirmPassword: string,
): string | null {
  if (!newPassword) return 'Введите новый пароль';
  if (newPassword.length < PASSWORD_RESET_MIN_LENGTH) {
    return `Минимум ${PASSWORD_RESET_MIN_LENGTH} символов`;
  }
  if (newPassword !== confirmPassword) return 'Пароли не совпадают';
  return null;
}

/** Mock helper for tests and demo UI hints. */
export function isMockPasswordResetCode(code: string): boolean {
  return code === MOCK_PASSWORD_RESET_CODE;
}
