import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BottomNav, SidebarNav } from '@/components/ui/BottomNav';
import { MobileHeader } from '@/components/ui/MobileHeader';
import { useAuthStore, useCurrentUser } from '@/stores/authStore';
import { can, isKnownUserRole, type Permission } from '@/permissions';
import { api } from '@/services/api';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useAuthSessionSync } from '@/hooks/useAuthSessionSync';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { PwaInstallBanner } from '@/components/ui/PwaInstallBanner';

export function AppLayout() {
  const user = useCurrentUser();
  const location = useLocation();
  const isOnline = useOnlineStatus();
  const { showBanner, installing, promptInstall, dismissPrompt } = usePwaInstall();
  const hideBottomNav = /^\/chat\/[^/]+/.test(location.pathname);

  const { data: conversations } = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: () => api.chat.getConversations(user!.id),
    enabled: !!user,
  });

  const chatBadge = conversations?.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0) ?? 0;

  const { data: notifications } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => api.notifications.getNotifications(user!.id),
    enabled: !!user,
  });

  const notifBadge = notifications?.filter((n) => !n.read).length ?? 0;

  const showAssignments =
    !!user &&
    (can(user, 'assignments:view-own') ||
      can(user, 'assignments:view-assigned') ||
      can(user, 'assignments:view-all'));

  const { data: assignments } = useQuery({
    queryKey: ['assignments', user?.id, user?.role],
    queryFn: () => api.assignments.getAssignments({ requesterId: user!.id }),
    enabled: showAssignments,
  });

  const assignmentsBadge = user?.role === 'student' ? (assignments?.length ?? 0) : 0;

  return (
    <div className="flex min-h-dvh min-w-0 overflow-x-hidden">
      <SidebarNav chatBadge={chatBadge} />
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col overflow-x-hidden">
        <MobileHeader
          showAssignments={showAssignments}
          assignmentsBadge={assignmentsBadge}
          notifBadge={notifBadge}
        />
        {!isOnline && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-center gap-2 bg-warning-muted px-4 py-2 text-sm text-warning"
          >
            <WifiOff className="h-4 w-4" aria-hidden />
            Нет подключения. Доступен только просмотр сохранённых данных.
          </div>
        )}
        <main className="flex min-h-0 flex-1 flex-col overflow-x-hidden">
          <Outlet />
        </main>
        {showBanner && (
          <PwaInstallBanner
            onInstall={promptInstall}
            onDismiss={dismissPrompt}
            installing={installing}
          />
        )}
        {!hideBottomNav && <BottomNav chatBadge={chatBadge} />}
      </div>
    </div>
  );
}

function AuthRouteLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center text-text-muted">Загрузка…</div>
  );
}

export function ProtectedRoute({ children }: { children?: React.ReactNode }) {
  const hydrated = useAuthStore.persist.hasHydrated();
  const user = useCurrentUser();
  useAuthSessionSync(user?.id);
  if (!hydrated) return <AuthRouteLoading />;
  if (!user || !isKnownUserRole(user.role)) return <Navigate to="/login" replace />;
  return children ? <>{children}</> : <Outlet />;
}

export function GuestRoute({ children }: { children?: React.ReactNode }) {
  const hydrated = useAuthStore.persist.hasHydrated();
  const user = useCurrentUser();
  if (!hydrated) return <AuthRouteLoading />;
  if (user && isKnownUserRole(user.role)) return <Navigate to="/home" replace />;
  return children ? <>{children}</> : <Outlet />;
}

export function AdminRoute({
  children,
  permission = 'admin:access',
}: {
  children?: React.ReactNode;
  permission?: Permission;
}) {
  const user = useCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (!can(user, permission)) return <Navigate to="/home" replace />;
  return children ? <>{children}</> : <Outlet />;
}
