/** Russian mobile: 11 digits starting with 7 (7 + 10 national digits). */
export const PHONE_DIGITS_LENGTH = 11;

export const PHONE_STORAGE_REGEX = /^\+79\d{9}$/;

export const PHONE_DISPLAY_PLACEHOLDER = '+7 (999) 999-99-99';

/** Extract and normalize digits from raw input or paste (8…, 9…, +7…). */
export function extractPhoneDigits(input: string): string {
  let digits = input.replace(/\D/g, '');

  if (digits.startsWith('8')) {
    digits = `7${digits.slice(1)}`;
  } else if (digits.length > 0 && !digits.startsWith('7')) {
    digits = `7${digits}`;
  }

  return digits.slice(0, PHONE_DIGITS_LENGTH);
}

/** Progressive mask: +7 (999) 999-99-99 */
export function formatPhoneDisplay(digits: string): string {
  const d = extractPhoneDigits(digits);
  if (d.length <= 1) return '+7';

  const rest = d.slice(1);
  let out = '+7 (' + rest.slice(0, 3);

  if (rest.length <= 3) return out;

  out += ') ' + rest.slice(3, 6);
  if (rest.length <= 6) return out;

  out += '-' + rest.slice(6, 8);
  if (rest.length <= 8) return out;

  out += '-' + rest.slice(8, 10);
  return out;
}

/** Stored value for API/forms: +79XXXXXXXXX (partial → +7). */
export function digitsToStoredPhone(digits: string): string {
  const d = extractPhoneDigits(digits);
  if (d.length <= 1) return '+7';
  return `+${d}`;
}

export function storedPhoneToDisplay(stored: string): string {
  return formatPhoneDisplay(extractPhoneDigits(stored));
}

export function isCompletePhone(stored: string): boolean {
  return PHONE_STORAGE_REGEX.test(stored);
}
