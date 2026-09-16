import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthSession, User } from '@/types';
import { api } from '@/services/api';
import { clearAppQueryCache } from '@/app/queryPersist';
import {
  sanitizePersistedUser,
} from '@/services/auth/sessionStorage';
import { resolveBootstrapSession } from '@/services/auth/bootstrapSession';
import { ApiError } from '@/services/api/types';
import { isKnownUserRole } from '@/permissions';
import {
  clearPocketBaseAuth,
  isPocketBaseMode,
  setPocketBaseAuth,
} from '@/services/api/pocketbase/client';
import {
  clearPersistedLoginPhone,
  persistLoginPhone,
  resolveOwnPhoneNumber,
} from '@/services/auth/ownPhone';
import { digitsToStoredPhone } from '@/utils/phone';

function withSessionPhone(session: AuthSession, phoneInput?: string): AuthSession {
  const phone = resolveOwnPhoneNumber(
    session.user.id,
    session.user.phone,
    phoneInput ? digitsToStoredPhone(phoneInput) : undefined,
  );
  if (phone) persistLoginPhone(session.user.id, phone);
  return { ...session, user: { ...session.user, phone } };
}

function mergeRefreshedSession(
  current: AuthSession,
  refreshed: AuthSession,
): AuthSession {
  const phone = resolveOwnPhoneNumber(
    refreshed.user.id,
    refreshed.user.phone,
    current.user.phone,
  );
  return { ...refreshed, user: { ...refreshed.user, phone } };
}

function hasAuthenticatedUser(session: AuthSession | null | undefined): boolean {
  const user = session?.user;
  return !!session?.token && !!user?.id && isKnownUserRole(user.role);
}

function partializeSession(session: AuthSession | null): AuthSession | null {
  if (!session?.token || !session.user?.id) return null;
  return {
    token: session.token,
    user: sanitizePersistedUser(session.user),
  };
}
interface AuthState {
  session: AuthSession | null;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  demoLogin: (role: 'student' | 'teacher' | 'admin') => Promise<void>;
  register: (
    phone: string,
    password: string,
    firstName: string,
    lastName: string,
    directionIds: string[],
    inviteToken: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  setSession: (session: AuthSession | null) => void;
  updateSessionUser: (user: User) => void;
  syncSession: () => Promise<void>;
  bootstrapFromStorage: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      isLoading: false,

      login: async (phone, password) => {
        set({ isLoading: true });
        try {
          const session = withSessionPhone(await api.auth.login(phone, password), phone);
          await clearAppQueryCache();
          if (isPocketBaseMode()) setPocketBaseAuth(session.token, session.user);
          set({ session, isLoading: false });
        } catch (e) {
          set({ isLoading: false });
          throw e;
        }
      },

      demoLogin: async (role) => {
        if (import.meta.env.PROD) {
          throw new Error('Демо-вход отключён в production-сборке');
        }
        set({ isLoading: true });
        try {
          const session = withSessionPhone(await api.auth.demoLogin(role));
          await clearAppQueryCache();
          if (isPocketBaseMode()) setPocketBaseAuth(session.token, session.user);
          set({ session, isLoading: false });
        } catch (e) {
          set({ isLoading: false });
          throw e;
        }
      },

      register: async (phone, password, firstName, lastName, directionIds, inviteToken) => {
        set({ isLoading: true });
        try {
          const session = withSessionPhone(
            await api.auth.register(
              phone,
              password,
              firstName,
              lastName,
              directionIds,
              inviteToken,
            ),
            phone,
          );
          await clearAppQueryCache();
          if (isPocketBaseMode()) setPocketBaseAuth(session.token, session.user);
          set({ session, isLoading: false });
        } catch (e) {
          set({ isLoading: false });
          throw e;
        }
      },

      logout: async () => {
        const userId = useAuthStore.getState().session?.user.id;
        await api.auth.logout();
        if (userId) clearPersistedLoginPhone(userId);
        if (isPocketBaseMode()) clearPocketBaseAuth();
        await clearAppQueryCache();
        set({ session: null });
      },

      setSession: (session) => set({ session }),

      updateSessionUser: (user) =>
        set((state) => {
          if (!state.session) return state;
          const phone = user.phone || state.session.user.phone;
          return {
            session: {
              ...state.session,
              user: sanitizePersistedUser({ ...user, phone }),
            },
          };
        }),

      syncSession: async () => {
        const current = useAuthStore.getState().session;
        if (!hasAuthenticatedUser(current)) return;

        if (isPocketBaseMode() && current) {
          setPocketBaseAuth(current.token, current.user);
        }

        try {
          const session = await api.auth.refreshSession();
          if (!session) return;

          const merged = mergeRefreshedSession(current!, session);

          set((state) => {
            const roleChanged =
              state.session?.user.role != null &&
              state.session.user.role !== merged.user.role;
            if (roleChanged) void clearAppQueryCache();
            return { session: merged };
          });

          if (isPocketBaseMode()) {
            setPocketBaseAuth(merged.token, merged.user);
          }
        } catch (error) {
          if (error instanceof ApiError && [401, 403, 404].includes(error.status ?? 0)) {
            if (isPocketBaseMode()) clearPocketBaseAuth();
            await clearAppQueryCache();
            set({ session: null });
          }
        }
      },

      bootstrapFromStorage: () => {
        const current = useAuthStore.getState().session;
        if (hasAuthenticatedUser(current) && current) {
          if (isPocketBaseMode()) setPocketBaseAuth(current.token, current.user);
          return;
        }

        const resolved = resolveBootstrapSession(null);
        if (resolved) set({ session: resolved });
      },
    }),
    {
      name: 'kvartira-auth',
      partialize: (s) => ({ session: partializeSession(s.session) }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        let session = resolveBootstrapSession(state.session) ?? state.session;
        if (session && hasAuthenticatedUser(session)) {
          const phone = resolveOwnPhoneNumber(session.user.id, session.user.phone);
          session = { ...session, user: { ...session.user, phone } };
          state.session = session;
          if (isPocketBaseMode()) setPocketBaseAuth(session.token, session.user);
        }
      },
    },
  ),
);

export function useCurrentUser(): User | null {
  return useAuthStore((s) => s.session?.user ?? null);
}
