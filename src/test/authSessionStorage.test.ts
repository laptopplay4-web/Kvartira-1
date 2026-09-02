import { describe, expect, it } from 'vitest';
import {
  isValidPersistedSession,
  sanitizePersistedSession,
  sanitizePersistedUser,
} from '@/services/auth/sessionStorage';
import type { AuthSession } from '@/types';

const baseSession: AuthSession = {
  token: 'token-1',
  user: {
    id: 'user-1',
    role: 'student',
    firstName: 'Анна',
    lastName: 'Смирнова',
    phone: '+79001234567',
  },
};

describe('sessionStorage', () => {
  it('strips oversized data URLs and pbfile refs from persisted user', () => {
    const user = sanitizePersistedUser({
      ...baseSession.user,
      avatarUrl: 'pbfile:abc',
      avatarOriginalUrl: `data:image/jpeg;base64,${'a'.repeat(200_000)}`,
    });

    expect(user.avatarUrl).toBeUndefined();
    expect(user.avatarOriginalUrl).toBeUndefined();
  });

  it('keeps normal avatar URLs', () => {
    const user = sanitizePersistedUser({
      ...baseSession.user,
      avatarUrl: 'https://example.com/a.jpg',
    });

    expect(user.avatarUrl).toBe('https://example.com/a.jpg');
  });

  it('rejects invalid persisted sessions', () => {
    expect(isValidPersistedSession(null)).toBe(false);
    expect(
      isValidPersistedSession({
        ...baseSession,
        user: { ...baseSession.user, role: 'guest' as never },
      }),
    ).toBe(false);
    expect(sanitizePersistedSession({
      ...baseSession,
      user: { ...baseSession.user, role: 'guest' as never },
    })).toBeNull();
  });

  it('sanitizes valid persisted sessions', () => {
    expect(
      sanitizePersistedSession({
        ...baseSession,
        user: { ...baseSession.user, avatarUrl: 'pbfile:abc' },
      }),
    ).toEqual({
      ...baseSession,
      user: { ...baseSession.user },
    });
  });
});
