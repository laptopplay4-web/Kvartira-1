import { useEffect, useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { queryClient } from './queryClient';
import { useAuthStore } from '@/stores/authStore';
import { ToastProvider } from '@/components/ui/Toast';
import { UserPreviewProvider } from '@/components/users/UserPreviewProvider';

function AuthHydrationGate({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(() => useAuthStore.persist.hasHydrated());

  useEffect(() => {
    const finish = () => {
      useAuthStore.getState().bootstrapFromStorage();
      setHydrated(true);
    };
    const unsub = useAuthStore.persist.onFinishHydration(finish);
    if (useAuthStore.persist.hasHydrated()) finish();
    return unsub;
  }, []);

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-text-muted">Загрузка…</div>
    );
  }

  return <>{children}</>;
}

export function AppProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthHydrationGate>
          <UserPreviewProvider>
            <RouterProvider router={router} />
          </UserPreviewProvider>
        </AuthHydrationGate>
      </ToastProvider>
    </QueryClientProvider>
  );
}
