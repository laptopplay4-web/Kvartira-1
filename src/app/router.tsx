import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { isProgressFeatureEnabled } from '@/config/features';
import { AppLayout, AdminRoute, GuestRoute, ProtectedRoute } from './layouts';
import { RouteErrorPage } from './RouteErrorPage';

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));
const HomePage = lazy(() => import('@/pages/home/HomePage'));
const LessonsPage = lazy(() => import('@/pages/lessons/LessonsPage'));
const LessonDetailPage = lazy(() => import('@/pages/lessons/LessonDetailPage'));
const BookLessonPage = lazy(() => import('@/pages/lessons/BookLessonPage'));
const ChatPage = lazy(() => import('@/pages/chat/ChatPage'));
const EventsPage = lazy(() => import('@/pages/events/EventsPage'));
const EventDetailPage = lazy(() => import('@/pages/events/EventDetailPage'));
const ProfilePage = lazy(() => import('@/pages/profile/ProfilePage'));
const SettingsLayout = lazy(() => import('@/pages/profile/settings/SettingsLayout'));
const AccountSettingsPage = lazy(() => import('@/pages/profile/settings/AccountSettingsPage'));
const SystemSettingsPage = lazy(() => import('@/pages/profile/settings/SystemSettingsPage'));
const AvailabilityPage = lazy(() => import('@/pages/profile/AvailabilityPage'));
const ProgressPage = lazy(() => import('@/pages/profile/ProgressPage'));
const HelpPage = lazy(() => import('@/pages/profile/HelpPage'));
const HelpTicketDetailPage = lazy(() => import('@/pages/profile/HelpTicketDetailPage'));
const SecurityPage = lazy(() => import('@/pages/profile/SecurityPage'));
const AssignmentsPage = lazy(() => import('@/pages/assignments/AssignmentsPage'));
const AssignmentDetailPage = lazy(() => import('@/pages/assignments/AssignmentDetailPage'));
const CreateAssignmentPage = lazy(() => import('@/pages/assignments/CreateAssignmentPage'));
const AssignmentGroupsPage = lazy(() => import('@/pages/assignments/AssignmentGroupsPage'));
const AssignmentGroupDetailPage = lazy(() => import('@/pages/assignments/AssignmentGroupDetailPage'));
const NotificationsPage = lazy(() => import('@/pages/notifications/NotificationsPage'));
const AdminHubPage = lazy(() => import('@/pages/admin/AdminHubPage'));
const AdminSchedulePage = lazy(() => import('@/pages/admin/AdminSchedulePage'));
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage'));
const AdminLegalPage = lazy(() => import('@/pages/admin/AdminLegalPage'));
const AdminSchoolSettingsPage = lazy(() => import('@/pages/admin/AdminSchoolSettingsPage'));
const LandingPage = lazy(() => import('@/pages/public/LandingPage'));
const DirectionDetailPage = lazy(() => import('@/pages/public/DirectionDetailPage'));
const TeacherDetailPage = lazy(() => import('@/pages/public/TeacherDetailPage'));
const LegalDocumentsPage = lazy(() => import('@/pages/legal/LegalDocumentsPage'));
const LegalDocumentDetailPage = lazy(() => import('@/pages/legal/LegalDocumentDetailPage'));
const LegalConsentsPage = lazy(() => import('@/pages/profile/LegalConsentsPage'));

export const appRoutes = [
  {
    errorElement: <RouteErrorPage />,
    children: [
  { path: '/directions/:id', element: <DirectionDetailPage /> },
  { path: '/teachers/:id', element: <TeacherDetailPage /> },
  { path: '/legal', element: <LegalDocumentsPage /> },
  { path: '/legal/:id', element: <LegalDocumentDetailPage /> },
  {
    element: <GuestRoute />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/home', element: <HomePage /> },
          { path: '/lessons', element: <LessonsPage /> },
          { path: '/lessons/book', element: <BookLessonPage /> },
          { path: '/lessons/availability', element: <AvailabilityPage /> },
          { path: '/lessons/:id', element: <LessonDetailPage /> },
          { path: '/chat', element: <ChatPage /> },
          { path: '/chat/:id', element: <ChatPage /> },
          { path: '/events', element: <EventsPage /> },
          { path: '/events/:id', element: <EventDetailPage /> },
          { path: '/profile', element: <ProfilePage /> },
          {
            path: '/profile/settings',
            element: <SettingsLayout />,
            children: [
              { index: true, element: <Navigate to="account" replace /> },
              { path: 'account', element: <AccountSettingsPage /> },
              { path: 'system', element: <SystemSettingsPage /> },
              { path: 'security', element: <SecurityPage /> },
            ],
          },
          { path: '/profile/security', element: <Navigate to="/profile/settings/security" replace /> },
          { path: '/profile/legal', element: <LegalConsentsPage /> },
          { path: '/profile/availability', element: <Navigate to="/lessons/availability" replace /> },
          {
            path: '/profile/progress',
            element: isProgressFeatureEnabled() ? (
              <ProgressPage />
            ) : (
              <Navigate to="/profile" replace />
            ),
          },
          { path: '/profile/help', element: <HelpPage /> },
          { path: '/profile/help/:id', element: <HelpTicketDetailPage /> },
          { path: '/assignments', element: <AssignmentsPage /> },
          { path: '/assignments/groups', element: <AssignmentGroupsPage /> },
          { path: '/assignments/groups/:id', element: <AssignmentGroupDetailPage /> },
          { path: '/assignments/create', element: <CreateAssignmentPage /> },
          { path: '/assignments/:id', element: <AssignmentDetailPage /> },
          { path: '/notifications', element: <NotificationsPage /> },
          {
            element: <AdminRoute permission="admin:access" />,
            children: [{ path: '/admin', element: <AdminHubPage /> }],
          },
          {
            element: <AdminRoute permission="admin:schedule" />,
            children: [{ path: '/admin/schedule', element: <AdminSchedulePage /> }],
          },
          {
            element: <AdminRoute permission="admin:users" />,
            children: [{ path: '/admin/users', element: <AdminUsersPage /> }],
          },
          {
            element: <AdminRoute permission="legal:manage" />,
            children: [{ path: '/admin/legal', element: <AdminLegalPage /> }],
          },
          {
            element: <AdminRoute permission="admin:events" />,
            children: [{ path: '/admin/events', element: <Navigate to="/events" replace /> }],
          },
          {
            element: <AdminRoute permission="admin:school-settings" />,
            children: [{ path: '/admin/school', element: <AdminSchoolSettingsPage /> }],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];

export const router = createBrowserRouter(appRoutes);
