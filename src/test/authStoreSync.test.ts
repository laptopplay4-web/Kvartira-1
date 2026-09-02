import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { AuthSession } from '@/types';

const refreshSession = vi.fn<() => Promise<AuthSession | null>>();

vi.mock('@/services/api', () => ({
  api: {
    auth: { refreshSession: () => refreshSession() },
  },
}));

vi.mock('@/services/api/pocketbase/client', () => ({
  isPocketBaseMode: () => false,
  setPocketBaseAuth: vi.fn(),
  clearPocketBaseAuth: vi.fn(),
}));

vi.mock('@/app/queryClient', () => ({
  queryClient: { clear: vi.fn() },
}));

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

describe('authStore bootstrapFromStorage', () => {
  beforeEach(async () => {
    vi.resetModules();
    refreshSession.mockReset();
    localStorage.clear();
    const { useAuthStore } = await import('@/stores/authStore');
    useAuthStore.setState({ session: baseSession, isLoading: false });
  });

  it('does not clear session after login when refresh is unavailable', async () => {
    refreshSession.mockResolvedValue(null);
    const { useAuthStore } = await import('@/stores/authStore');

    useAuthStore.getState().bootstrapFromStorage();

    expect(useAuthStore.getState().session).toEqual(baseSession);
  });
});

describe('authStore syncSession', () => {
  beforeEach(async () => {
    vi.resetModules();
    refreshSession.mockReset();
    localStorage.clear();
    const { useAuthStore } = await import('@/stores/authStore');
    useAuthStore.setState({ session: baseSession, isLoading: false });
  });

  it('keeps persisted session when refreshSession returns null (mock no-op)', async () => {
    refreshSession.mockResolvedValue(null);
    const { useAuthStore } = await import('@/stores/authStore');

    await useAuthStore.getState().syncSession();

    expect(useAuthStore.getState().session).toEqual(baseSession);
  });

  it('clears session when refreshSession throws auth error', async () => {
    const { ApiError: StoreApiError } = await import('@/services/api/types');
    refreshSession.mockRejectedValue(new StoreApiError('Unauthorized', 'UNAUTHORIZED', 401));
    const { useAuthStore } = await import('@/stores/authStore');

    await useAuthStore.getState().syncSession();

    expect(useAuthStore.getState().session).toBeNull();
  });
});
