/** Minimum password length — PocketBase auth default is 8. */
export const AUTH_PASSWORD_MIN_LENGTH = 8;

/** Demo SMS code in mock mode until a real provider is connected. */
export const MOCK_PASSWORD_RESET_CODE = '000000';

export const PASSWORD_RESET_CODE_LENGTH = 6;

/** Reset request validity (mock). */
export const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;

export const PASSWORD_RESET_MIN_LENGTH = AUTH_PASSWORD_MIN_LENGTH;