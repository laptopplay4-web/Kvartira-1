import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { UserPreviewModal } from '@/components/users/UserPreviewModal';
import { useCurrentUser } from '@/stores/authStore';
import type { User } from '@/types';

type UserPreviewTarget = User | string;

interface UserPreviewContextValue {
  openUserPreview: (target: UserPreviewTarget) => void;
  closeUserPreview: () => void;
}

const UserPreviewContext = createContext<UserPreviewContextValue | null>(null);

function resolveTarget(target: UserPreviewTarget): { userId: string; seedUser: User | null } {
  if (typeof target === 'string') {
    return { userId: target, seedUser: null };
  }
  return { userId: target.id, seedUser: target };
}

export function UserPreviewProvider({ children }: { children: ReactNode }) {
  const currentUser = useCurrentUser();
  const [userId, setUserId] = useState<string | null>(null);
  const [seedUser, setSeedUser] = useState<User | null>(null);

  const closeUserPreview = useCallback(() => {
    setUserId(null);
    setSeedUser(null);
  }, []);

  const openUserPreview = useCallback(
    (target: UserPreviewTarget) => {
      if (!currentUser) return;
      const resolved = resolveTarget(target);
      if (!resolved.userId) return;
      setUserId(resolved.userId);
      setSeedUser(resolved.seedUser);
    },
    [currentUser],
  );

  const value = useMemo(
    () => ({ openUserPreview, closeUserPreview }),
    [openUserPreview, closeUserPreview],
  );

  return (
    <UserPreviewContext.Provider value={value}>
      {children}
      {currentUser ? (
        <UserPreviewModal
          open={!!userId}
          userId={userId}
          seedUser={seedUser}
          requesterId={currentUser.id}
          onClose={closeUserPreview}
        />
      ) : null}
    </UserPreviewContext.Provider>
  );
}

export function useUserPreview(): UserPreviewContextValue {
  const ctx = useContext(UserPreviewContext);
  if (!ctx) {
    return {
      openUserPreview: () => undefined,
      closeUserPreview: () => undefined,
    };
  }
  return ctx;
}
