import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminRoute, GuestRoute } from '@/app/layouts';
import type { User } from '@/types';

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

let mockUser: User | null = null;

vi.mock('@/stores/authStore', () => ({
  useCurrentUser: () => mockUser,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined }),
}));

describe('GuestRoute', () => {
  it('redirects authenticated user from landing to /home', () => {
    mockUser = studentUser;
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
