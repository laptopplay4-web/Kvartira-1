import { describe, it, expect } from 'vitest';
import {
  digitsToStoredPhone,
  extractPhoneDigits,
  formatPhoneDisplay,
  isCompletePhone,
  phoneFromSyntheticEmail,
  storedPhoneToDisplay,
} from '@/utils/phone';
import { maskPhone } from '@/utils';

describe('phone utils', () => {
  it('formats progressive display mask', () => {
    expect(formatPhoneDisplay('7')).toBe('+7');
    expect(formatPhoneDisplay('79')).toBe('+7 (9');
    expect(formatPhoneDisplay('7999')).toBe('+7 (999');
    expect(formatPhoneDisplay('7999123')).toBe('+7 (999) 123');
    expect(formatPhoneDisplay('79991234567')).toBe('+7 (999) 123-45-67');
  });

  it('extracts digits from paste variants', () => {
    expect(extractPhoneDigits('+7 (999) 123-45-67')).toBe('79991234567');
    expect(extractPhoneDigits('89991234567')).toBe('79991234567');
    expect(extractPhoneDigits('9991234567')).toBe('79991234567');
    expect(extractPhoneDigits('abc7999def')).toBe('7999');
  });

  it('stores normalized phone for API', () => {
    expect(digitsToStoredPhone('79991234567')).toBe('+79991234567');
    expect(digitsToStoredPhone('7')).toBe('+7');
    expect(storedPhoneToDisplay('+79991234567')).toBe('+7 (999) 123-45-67');
    expect(storedPhoneToDisplay('+7')).toBe('');
  });

  it('validates complete phone', () => {
    expect(isCompletePhone('+79991234567')).toBe(true);
    expect(isCompletePhone('+7')).toBe(false);
    expect(isCompletePhone('+7999123456')).toBe(false);
  });

  it('masks phone safely when missing or short', () => {
    expect(maskPhone(undefined)).toBe('—');
    expect(maskPhone(null)).toBe('—');
    expect(maskPhone('')).toBe('—');
    expect(maskPhone('+7900')).toBe('+7900');
    expect(maskPhone('+79001234567')).toBe('+790 *** ** 67');
  });

  it('recovers phone from synthetic PB email', () => {
    expect(phoneFromSyntheticEmail('79001234567@kvartira.local')).toBe('+79001234567');
    expect(phoneFromSyntheticEmail('user@example.com')).toBe('');
  });
});
