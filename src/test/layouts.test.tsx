import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminRoute, GuestRoute } from '@/app/layouts';
import type { AuthSession, User } from '@/types';

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

function sessionFor(user: User | null, token = 'token-1'): AuthSession | null {
  return user ? { token, user } : null;
}

let mockUser: User | null = null;
let mockSession: AuthSession | null = null;
let mockHydrated = true;

vi.mock('@/stores/authStore', () => ({
  useCurrentUser: () => mockUser,
  useAuthStore: Object.assign(
    (selector: (s: { session: AuthSession | null }) => unknown) => selector({ session: mockSession }),
    {
      persist: {
        hasHydrated: () => mockHydrated,
      },
    },
  ),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined }),
}));

describe('GuestRoute', () => {
  it('shows loading until auth store is hydrated', () => {
    mockUser = null;
    mockSession = null;
    mockHydrated = false;
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<GuestRoute />}>
            <Route index element={<div>Landing</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Загрузка…')).toBeInTheDocument();
    expect(screen.queryByText('Landing')).not.toBeInTheDocument();
    mockHydrated = true;
  });

  it('redirects authenticated user from landing to /home', () => {
    mockHydrated = true;
    mockUser = studentUser;
    mockSession = sessionFor(studentUser);
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/home" element={<div>Home</div>} />
          <Route path="/" element={<GuestRoute />}>
            <Route index element={<div>Landing</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.queryByText('Landing')).not.toBeInTheDocument();
  });

  it('does not redirect invalid session to /home', () => {
    mockHydrated = true;
    mockUser = { ...studentUser, role: 'guest' as never };
    mockSession = sessionFor(mockUser);
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/home" element={<div>Home</div>} />
          <Route path="/" element={<GuestRoute />}>
            <Route index element={<div>Landing</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Landing')).toBeInTheDocument();
    expect(screen.queryByText('Home')).not.toBeInTheDocument();
  });
});

describe('AdminRoute', () => {
  it('allows admin with admin:schedule permission', () => {
    mockUser = adminUser;
    render(
      <MemoryRouter initialEntries={['/admin/schedule']}>
        <Routes>
          <Route path="/home" element={<div>Home</div>} />
          <Route
            path="/admin/schedule"
            element={
              <AdminRoute permission="admin:schedule">
                <div>Schedule page</div>
              </AdminRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Schedule page')).toBeInTheDocument();
  });

  it('redirects student without admin:schedule permission', () => {
    mockUser = studentUser;
    render(
      <MemoryRouter initialEntries={['/admin/schedule']}>
        <Routes>
          <Route path="/home" element={<div>Home</div>} />
          <Route
            path="/admin/schedule"
            element={
              <AdminRoute permission="admin:schedule">
                <div>Schedule page</div>
              </AdminRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.queryByText('Schedule page')).not.toBeInTheDocument();
  });
});
