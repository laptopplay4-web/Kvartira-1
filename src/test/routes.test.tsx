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
import type { User } from '@/types';

const mockGetLessons = vi.fn();
const mockGetDirections = vi.fn();
const mockGetTeachers = vi.fn();
const mockGetEvents = vi.fn();
const mockGetConversations = vi.fn();
const mockGetNotifications = vi.fn();
const mockGetAllUsers = vi.fn();

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
    },
  },
}));

vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}));

let mockUser: User | null;

vi.mock('@/stores/authStore', () => ({
  useCurrentUser: () => mockUser,
  useAuthStore: (selector: (s: { logout: () => void; updateSessionUser: () => void }) => unknown) =>
    selector({ logout: vi.fn(), updateSessionUser: vi.fn() }),
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
    mockGetAllUsers.mockResolvedValue([adminUser, studentUser]);
  });

  it('redirects admin /admin to /home', async () => {
    mockUser = adminUser;
    renderRoute('/admin');

    await waitFor(() => {
      expect(screen.getByText('Административный обзор')).toBeInTheDocument();
    });
  });

  it('renders /admin/schedule inside AppLayout', async () => {
    mockUser = adminUser;
    renderRoute('/admin/schedule');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Общее расписание' })).toBeInTheDocument();
    });

    expect(screen.getAllByLabelText('Основная навигация').length).toBeGreaterThanOrEqual(2);
  });

  it('renders /admin/users inside AppLayout', async () => {
    mockUser = adminUser;
    renderRoute('/admin/users');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Пользователи' })).toBeInTheDocument();
    });

    expect(screen.getAllByLabelText('Основная навигация').length).toBeGreaterThanOrEqual(2);
  });

  it('blocks student from /admin', async () => {
    mockUser = studentUser;
    renderRoute('/admin');

    await waitFor(() => {
      expect(screen.queryByText('Административный обзор')).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Администрирование')).not.toBeInTheDocument();
  });

  it('blocks student from /admin/schedule', async () => {
    mockUser = studentUser;
    renderRoute('/admin/schedule');

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Общее расписание' })).not.toBeInTheDocument();
    });
  });

  it('blocks teacher from /admin/schedule', async () => {
    mockUser = teacherUser;
    renderRoute('/admin/schedule');

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Общее расписание' })).not.toBeInTheDocument();
    });
  });

  it('blocks student from /admin/users', async () => {
    mockUser = studentUser;
    renderRoute('/admin/users');

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Пользователи' })).not.toBeInTheDocument();
    });
  });
});

describe('admin navigation links', () => {
  beforeEach(() => {
    mockUser = adminUser;
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    );
  });

  it('Sidebar Admin link points to /home', () => {
    render(
      <MemoryRouter>
        <SidebarNav chatBadge={0} notifBadge={0} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /Админ/ })).toHaveAttribute('href', '/home');
  });

  it('Profile admin menu points to /home', () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('link', { name: /Администрирование/ })).toHaveAttribute(
      'href',
      '/home',
    );
  });

  it('Schedule back button falls back to /home', async () => {
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

    expect(screen.getByRole('button', { name: /Главная/ })).toBeInTheDocument();
    expect(await screen.findByText('Нет занятий')).toBeInTheDocument();
  });

  it('Users back button falls back to /home', async () => {
    mockGetAllUsers.mockResolvedValue([]);

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <AdminUsersPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('button', { name: /Главная/ })).toBeInTheDocument();
    expect(await screen.findByText('Нет пользователей')).toBeInTheDocument();
  });

  it('AdminUsersPage reuses shared users cache without refetch', async () => {
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
});
