import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BottomNav, SidebarNav } from '@/components/ui/BottomNav';
import { MobileHeader } from '@/components/ui/MobileHeader';
import { TeacherDirectionsSetupModal } from '@/components/directions/TeacherDirectionsSetupModal';
import { PendingConsentModal } from '@/components/legal/PendingConsentModal';
import { useAuthStore, useCurrentUser } from '@/stores/authStore';
import { can, isKnownUserRole, type Permission } from '@/permissions';
import { api } from '@/services/api';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useAuthSessionSync } from '@/hooks/useAuthSessionSync';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { useMarkPassiveNotificationsOnLeave } from '@/hooks/useMarkPassiveNotificationsOnLeave';
import { useWarmAppCache } from '@/hooks/useWarmAppCache';
import { countUnreadAssignments } from '@/services/assignments/unread';
import { countUnreadEventParticipationsForNav } from '@/services/events/unread';
import { countInboxUnreadNotifications } from '@/services/notifications/helpers';
import { countOpenSupportTickets } from '@/services/support/adminInbox';
import { PwaInstallBanner } from '@/components/ui/PwaInstallBanner';

export function AppLayout() {
  const user = useCurrentUser();
  const location = useLocation();
  const isOnline = useOnlineStatus();
  const { showBanner, installing, promptInstall, dismissPrompt } = usePwaInstall();
  const hideBottomNav = /^\/chat\/[^/]+/.test(location.pathname);

  // Живёт в layout: NotificationsPage при уходе размонтируется и не видит новую location.
  useMarkPassiveNotificationsOnLeave(user?.id);
  // Cold start: idle-prefetch вкладок + последних чатов (persist — в providers).
  useWarmAppCache(user);

  const { data: conversations } = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: () => api.chat.getConversations(user!.id),
    enabled: !!user,
  });

  const chatBadge = conversations?.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0) ?? 0;

  const { data: notifications, isFetched: notificationsFetched } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => api.notifications.getNotifications(user!.id),
    enabled: !!user,
  });

  const notifBadge = countInboxUnreadNotifications(notifications ?? []);

  const showAssignments =
    !!user &&
    (can(user, 'assignments:view-own') ||
      can(user, 'assignments:view-assigned') ||
      can(user, 'assignments:view-all'));

  const { data: assignments, isFetched: assignmentsFetched } = useQuery({
    queryKey: ['assignments', user?.id, user?.role],
    queryFn: () => api.assignments.getAssignments({ requesterId: user!.id }),
    enabled: showAssignments && user?.role === 'student',
  });

  const assignmentIds = assignments?.map((a) => a.id) ?? [];
  const assignmentTitles = assignments
    ? new Map(assignments.map((a) => [a.title, a.id]))
    : undefined;

  const assignmentsBadge =
    user?.role === 'student' && notificationsFetched && assignmentsFetched
      ? countUnreadAssignments(assignmentIds, user.id, notifications ?? [], assignmentTitles, {
          seed: true,
        })
      : 0;

  const eventsBadge = user
    ? countUnreadEventParticipationsForNav(notifications ?? [], user.id, {
        ignoreTabSeen: user.role === 'student',
      })
    : 0;

  const showAdminSupportInbox = !!user && can(user, 'support:view-all-tickets');
  const { data: openSupportTickets } = useQuery({
    queryKey: ['support', 'tickets', 'admin-open-count', user?.id],
    queryFn: () => api.support.getTickets({ requesterId: user!.id, status: 'open' }),
    enabled: showAdminSupportInbox,
  });

  const profileBadge = showAdminSupportInbox
    ? countOpenSupportTickets(openSupportTickets)
    : 0;

  return (
    <div className="flex min-h-dvh min-w-0 overflow-x-hidden">
      <SidebarNav chatBadge={chatBadge} eventsBadge={eventsBadge} profileBadge={profileBadge} />
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
        <TeacherDirectionsSetupModal />
        <PendingConsentModal />
        {showBanner && (
          <PwaInstallBanner
            onInstall={promptInstall}
            onDismiss={dismissPrompt}
            installing={installing}
          />
        )}
        {!hideBottomNav && (
          <BottomNav chatBadge={chatBadge} eventsBadge={eventsBadge} profileBadge={profileBadge} />
        )}
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
