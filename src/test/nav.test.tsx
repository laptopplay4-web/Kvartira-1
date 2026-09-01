import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BottomNav, SidebarNav } from '@/components/ui/BottomNav';
import type { User } from '@/types';

const studentUser: User = {
  id: 'student-1',
  role: 'student',
  firstName: 'Анна',
  lastName: 'Иванова',
  phone: '+79001111111',
};

const adminUser: User = {
  id: 'admin-1',
  role: 'admin',
  firstName: 'Админ',
  lastName: 'Школы',
  phone: '+79009999999',
};

let mockUser: User = studentUser;

vi.mock('@/stores/authStore', () => ({
  useCurrentUser: () => mockUser,
}));

describe('BottomNav active state', () => {
  it('highlights active item with brand palette', () => {
    render(
      <MemoryRouter initialEntries={['/chat']}>
        <BottomNav chatBadge={0} />
      </MemoryRouter>,
    );

    const chatLink = screen.getByRole('link', { name: /Чат/ });
    expect(chatLink).toHaveAttribute('aria-current', 'page');
    expect(chatLink.className).toMatch(/bg-brand-muted/);
    expect(chatLink.className).toMatch(/text-brand/);
    expect(screen.getByRole('link', { name: /Главная/ })).not.toHaveAttribute('aria-current');
  });
});

describe('SidebarNav P1 notifications', () => {
  beforeEach(() => {
    mockUser = studentUser;
  });

  it('shows notifications link when unread is 0', () => {
    render(
      <MemoryRouter>
        <SidebarNav chatBadge={0} notifBadge={0} />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: /Уведомления/ });
    expect(link).toHaveAttribute('href', '/notifications');
    expect(link.querySelector('.rounded-full.bg-brand')).toBeNull();
  });

  it('shows unread badge only when unread > 0', () => {
    render(
      <MemoryRouter>
        <SidebarNav chatBadge={0} notifBadge={3} />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: /Уведомления/ });
    expect(link).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});

describe('SidebarNav active state', () => {
  beforeEach(() => {
    mockUser = studentUser;
  });

  it('marks current page with aria-current', () => {
    render(
      <MemoryRouter initialEntries={['/lessons']}>
        <SidebarNav chatBadge={0} notifBadge={0} />
      </MemoryRouter>,
    );

    const lessonsLink = screen.getByRole('link', { name: /Занятия/ });
    expect(lessonsLink).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Главная/ })).not.toHaveAttribute('aria-current');
  });
});

describe('SidebarNav admin active state', () => {
  beforeEach(() => {
    mockUser = adminUser;
  });

  it('highlights admin link on admin sub-routes', () => {
    render(
      <MemoryRouter initialEntries={['/admin/schedule']}>
        <SidebarNav chatBadge={0} notifBadge={0} />
      </MemoryRouter>,
    );

    const adminLink = screen.getByRole('link', { name: /Админ/ });
    expect(adminLink).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Главная/ })).not.toHaveAttribute('aria-current');
  });
});
