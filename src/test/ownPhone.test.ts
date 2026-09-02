import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearPersistedLoginPhone,
  formatOwnPhoneDisplay,
  persistLoginPhone,
  readPersistedLoginPhone,
  resolveOwnPhoneNumber,
} from '@/services/auth/ownPhone';

describe('ownPhone', () => {
  const userId = 'user-test';

  beforeEach(() => {
    clearPersistedLoginPhone(userId);
    localStorage.removeItem('pocketbase_auth');
  });

  it('persists and reads login phone per user', () => {
    persistLoginPhone(userId, '+7 (900) 123-45-67');
    expect(readPersistedLoginPhone(userId)).toBe('+79001234567');
    clearPersistedLoginPhone(userId);
    expect(readPersistedLoginPhone(userId)).toBe('');
  });

  it('resolves first valid phone candidate then persisted value', () => {
    persistLoginPhone(userId, '+79007654321');
    expect(resolveOwnPhoneNumber(userId, '', undefined, '+79001112233')).toBe('+79001112233');
    expect(resolveOwnPhoneNumber(userId, '')).toBe('+79007654321');
  });

  it('formats own phone for display', () => {
    expect(formatOwnPhoneDisplay('+79001234567')).toBe('+7 (900) 123-45-67');
    expect(formatOwnPhoneDisplay('')).toBe('—');
  });

  it('recovers phone from pocketbase_auth email when phone field missing', () => {
    localStorage.setItem(
      'pocketbase_auth',
      JSON.stringify({
        token: 't',
        record: { id: userId, email: '79001234567@kvartira.local' },
      }),
    );
    expect(resolveOwnPhoneNumber(userId)).toBe('+79001234567');
  });
});
