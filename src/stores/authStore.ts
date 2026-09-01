import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthSession, User } from '@/types';
import { api } from '@/services/api';
import { queryClient } from '@/app/queryClient';
import {
  clearPocketBaseAuth,
  isPocketBaseMode,
  setPocketBaseAuth,
} from '@/services/api/pocketbase/client';

interface AuthState {
  session: AuthSession | null;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  demoLogin: (role: 'student' | 'teacher' | 'admin') => Promise<void>;
  register: (phone: string, password: string, firstName: string, lastName: string) => Promise<void>;
  logout: () => Promise<void>;
  setSession: (session: AuthSession | null) => void;
  updateSessionUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      isLoading: false,

      login: async (phone, password) => {
        set({ isLoading: true });
        try {
          const session = await api.auth.login(phone, password);
          queryClient.clear();
          set({ session, isLoading: false });
        } catch (e) {
          set({ isLoading: false });
          throw e;
        }
      },

      demoLogin: async (role) => {
        set({ isLoading: true });
        try {
          const session = await api.auth.demoLogin(role);
          queryClient.clear();
          set({ session, isLoading: false });
        } catch (e) {
          set({ isLoading: false });
          throw e;
        }
      },

      register: async (phone, password, firstName, lastName) => {
        set({ isLoading: true });
        try {
          const session = await api.auth.register(phone, password, firstName, lastName);
          queryClient.clear();
          set({ session, isLoading: false });
        } catch (e) {
          set({ isLoading: false });
          throw e;
        }
      },

      logout: async () => {
        await api.auth.logout();
        if (isPocketBaseMode()) clearPocketBaseAuth();
        queryClient.clear();
        set({ session: null });
      },

      setSession: (session) => set({ session }),

      updateSessionUser: (user) =>
        set((state) =>
          state.session ? { session: { ...state.session, user } } : state,
        ),
    }),
    {
      name: 'kvartira-auth',
      partialize: (s) => ({ session: s.session }),
      onRehydrateStorage: () => (state) => {
        if (state?.session && isPocketBaseMode()) {
          setPocketBaseAuth(state.session.token, state.session.user);
        }
      },
    },
  ),
);

export function useCurrentUser(): User | null {
  return useAuthStore((s) => s.session?.user ?? null);
}
