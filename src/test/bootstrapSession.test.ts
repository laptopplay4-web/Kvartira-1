import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { AuthSession } from '@/types';

const mockPb = {
  authStore: {
    token: '',
    isValid: false,
    record: null as Record<string, unknown> | null,
  },
};

vi.mock('@/services/api/pocketbase/client', () => ({
  isPocketBaseMode: () => true,
  getPocketBase: () => mockPb,
  setPocketBaseAuth: vi.fn(),
}));

import { resolveBootstrapSession } from '@/services/auth/bootstrapSession';

const baseSession: AuthSession = {
  token: 'token-zustand',
  user: {
    id: 'user-1',
    role: 'student',
    firstName: 'Анна',
    lastName: 'Смирнова',
    phone: '+79001234567',
  },
};

describe('bootstrapSession', () => {
  beforeEach(() => {
    mockPb.authStore.token = '';
    mockPb.authStore.isValid = false;
    mockPb.authStore.record = null;
  });

  it('prefers valid zustand session', () => {
    expect(resolveBootstrapSession(baseSession)?.token).toBe('token-zustand');
  });

  it('falls back to pocketbase_auth when zustand session is missing', () => {
    mockPb.authStore.token = 'token-pb';
    mockPb.authStore.isValid = true;
    mockPb.authStore.record = {
      id: 'user-2',
      phone: '+79007654321',
      role: 'teacher',
      firstName: 'Иван',
      lastName: 'Петров',
    };

    const session = resolveBootstrapSession(null);
    expect(session?.token).toBe('token-pb');
    expect(session?.user.role).toBe('teacher');
  });

  it('accepts zustand session without phone for bootstrap', () => {
    const session = resolveBootstrapSession({
      token: 'token-zustand',
      user: {
        id: 'user-1',
        role: 'student',
        firstName: 'Анна',
        lastName: 'Смирнова',
        phone: '',
      },
    });
    expect(session?.token).toBe('token-zustand');
  });
});
