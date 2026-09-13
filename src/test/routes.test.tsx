import { Suspense } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import {
  createMemoryRouter,
  RouterProvider,
  MemoryRouter,
  type RouteObject,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { appRoutes } from '@/app/router';
import { SidebarNav } from '@/components/ui/BottomNav';
import ProfilePage from '@/pages/profile/ProfilePage';
import AdminSchedulePage from '@/pages/admin/AdminSchedulePage';
import AdminUsersPage from '@/pages/admin/AdminUsersPage';
import type { AuthSession, User } from '@/types';
import { formatUserName } from '@/utils';

const mockGetLessons = vi.fn();
const mockGetDirections = vi.fn();
const mockGetTeachers = vi.fn();
const mockGetEvents = vi.fn();
const mockGetConversations = vi.fn();
const mockGetNotifications = vi.fn();
const mockGetAllUsers = vi.fn();
const mockUpdateUserRole = vi.fn();
const mockGetTickets = vi.fn();

vi.mock('@/services/api', () => ({
  api: {
    lessons: {
      getLessons: (...args: unknown[]) => mockGetLessons(...args),
      getDirections: (...args: unknown[]) => mockGetDirections(...args),
      getTeachers: (...args: unknown[]) => mockGetTeachers(...args),
    },
    events: {
      getEvents: (...args: unknown[]) => mockGetEvents(...args),
    },
    chat: {
      getConversations: (...args: unknown[]) => mockGetConversations(...args),
    },
    notifications: {
      getNotifications: (...args: unknown[]) => mockGetNotifications(...args),
    },
    users: {
      getAllUsers: (...args: unknown[]) => mockGetAllUsers(...args),
      updateUserRole: (...args: unknown[]) => mockUpdateUserRole(...args),
    },
    support: {
      getTickets: (...args: unknown[]) => mockGetTickets(...args),
    },
  },
}));

vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}));

vi.mock('@/hooks/useAuthSessionSync', () => ({
  useAuthSessionSync: vi.fn(),
}));

let mockUser: User | null;
let mockSession: AuthSession | null = null;

function setMockUser(user: User | null) {
  mockUser = user;
  mockSession = user ? { token: 'token-test', user } : null;
}

vi.mock('@/stores/authStore', () => ({
  useCurrentUser: () => mockUser,
  useAuthStore: Object.assign(
    (selector: (s: {
      session: AuthSession | null;
      logout: () => void;
      updateSessionUser: () => void;
      syncSession: () => Promise<void>;
      bootstrapFromStorage: () => void;
    }) => unknown) =>
      selector({
        session: mockSession,
        logout: vi.fn(),
        updateSessionUser: vi.fn(),
        syncSession: vi.fn(),
        bootstrapFromStorage: vi.fn(),
      }),
    {
      persist: {
        hasHydrated: () => true,
      },
    },
  ),
}));

const adminUser: User = {
  id: 'admin-1',
  role: 'admin',
  firstName: 'Админ',
  lastName: 'Школы',
  phone: '+79009999999',
};

const studentUser: User = {
  id: 'student-1',
  role: 'student',
  firstName: 'Анна',
  lastName: 'Иванова',
  phone: '+79001111111',
};

const teacherUser: User = {
  id: 'teacher-1',
  role: 'teacher',
  firstName: 'Мария',
  lastName: 'Петрова',
  phone: '+79002222222',
};

function renderRoute(initialPath: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter(appRoutes as RouteObject[], {
    initialEntries: [initialPath],
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div data-testid="suspense">loading</div>}>
        <RouterProvider router={router} />
      </Suspense>
    </QueryClientProvider>,
  );
}

describe('admin shell routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLessons.mockResolvedValue([]);
    mockGetDirections.mockResolvedValue([]);
    mockGetTeachers.mockResolvedValue([]);
    mockGetEvents.mockResolvedValue([]);
    mockGetConversations.mockResolvedValue([]);
    mockGetNotifications.mockResolvedValue([]);
    mockGetTickets.mockResolvedValue([]);
    mockGetAllUsers.mockResolvedValue([adminUser, studentUser]);
    mockUpdateUserRole.mockResolvedValue(studentUser);
  });

  it('renders admin hub at /admin', async () => {
    setMockUser(adminUser);
    renderRoute('/admin');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Администрирование' })).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /Расписание/ })).toHaveAttribute('href', '/admin/schedule');
    expect(screen.getByRole('link', { name: /Пользователи/ })).toHaveAttribute('href', '/admin/users');
    expect(screen.queryByRole('link', { name: /Мероприятия/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Помощь/ })).toHaveAttribute('href', '/admin/help');
    expect(screen.getByRole('link', { name: /Направления/ })).toHaveAttribute(
      'href',
      '/admin/directions',
    );
    expect(screen.getByRole('link', { name: /Школа/ })).toHaveAttribute('href', '/admin/school');
    expect(screen.getByRole('link', { name: /Документы/ })).toHaveAttribute('href', '/admin/legal');
  });

  it('redirects /admin/events to /events for admin', async () => {
    setMockUser(adminUser);
    mockGetEvents.mockResolvedValue([]);
    renderRoute('/admin/events');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Мероприятия' })).toBeInTheDocument();
    });
  });

  it('renders /admin/schedule inside AppLayout', async () => {
    setMockUser(adminUser);
    renderRoute('/admin/schedule');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Общее расписание' })).toBeInTheDocument();
    });

    expect(screen.getAllByLabelText('Основная навигация').length).toBeGreaterThanOrEqual(2);
  });

  it('renders /admin/users inside AppLayout', async () => {
    setMockUser(adminUser);
    renderRoute('/admin/users');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Пользователи' })).toBeInTheDocument();
    });

    expect(screen.getAllByLabelText('Основная навигация').length).toBeGreaterThanOrEqual(2);
  });

  it('blocks student from /admin', async () => {
    setMockUser(studentUser);
    renderRoute('/admin');

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: formatUserName(adminUser) })).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Администрирование')).not.toBeInTheDocument();
  });

  it('blocks student from /admin/schedule', async () => {
    setMockUser(studentUser);
    renderRoute('/admin/schedule');

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Общее расписание' })).not.toBeInTheDocument();
    });
  });

  it('blocks teacher from /admin/schedule', async () => {
    setMockUser(teacherUser);
    renderRoute('/admin/schedule');

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Общее расписание' })).not.toBeInTheDocument();
    });
  });

  it('blocks student from /admin/users', async () => {
    setMockUser(studentUser);
    renderRoute('/admin/users');

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Пользователи' })).not.toBeInTheDocument();
    });
  });
});

describe('admin navigation links', () => {
  beforeEach(() => {
    setMockUser(adminUser);
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    );
  });

  it('Sidebar Admin link points to /admin', () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <SidebarNav chatBadge={0} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('link', { name: /Админ/ })).toHaveAttribute('href', '/admin');
  });

  it('Profile admin menu points to /admin', () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('link', { name: /Администрирование/ })).toHaveAttribute(
      'href',
      '/admin',
    );
  });

  it('Schedule back button falls back to /admin', async () => {
    mockGetLessons.mockResolvedValue([]);
    mockGetAllUsers.mockResolvedValue([]);
    mockGetDirections.mockResolvedValue([]);

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <AdminSchedulePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('button', { name: /Администрирование/ })).toBeInTheDocument();
    expect(await screen.findByText('Нет занятий')).toBeInTheDocument();
  });

  it('Users back button falls back to /admin', async () => {
    setMockUser(adminUser);
    mockGetAllUsers.mockResolvedValue([]);

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <AdminUsersPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('button', { name: /Администрирование/ })).toBeInTheDocument();
    expect(await screen.findByText('Нет пользователей')).toBeInTheDocument();
  });

  it('AdminUsersPage reuses shared users cache without refetch', async () => {
    setMockUser(adminUser);
    vi.clearAllMocks();
    const users = [adminUser, studentUser];
    mockGetAllUsers.mockResolvedValue(users);
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity, refetchOnMount: false },
      },
    });
    await queryClient.prefetchQuery({
      queryKey: ['users'],
      queryFn: () => mockGetAllUsers(),
    });
    vi.clearAllMocks();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminUsersPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Пользователи' })).toBeInTheDocument();
    });

    expect(mockGetAllUsers).not.toHaveBeenCalled();
  });

  it('AdminUsersPage offers teacher section add and demote controls', async () => {
    setMockUser(adminUser);
    mockGetAllUsers.mockResolvedValue([adminUser, teacherUser, studentUser]);

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <AdminUsersPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('button', { name: 'Добавить преподавателя' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: `Сделать учеником: ${formatUserName(teacherUser)}` }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Сделать преподавателем/ })).not.toBeInTheDocument();
  });
});
