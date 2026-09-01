import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BottomNav, SidebarNav } from '@/components/ui/BottomNav';
import { MobileHeader } from '@/components/ui/MobileHeader';
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

  it('highlights lessons on /lessons/availability', () => {
    render(
      <MemoryRouter initialEntries={['/lessons/availability']}>
        <BottomNav chatBadge={0} />
      </MemoryRouter>,
    );

    const lessonsLink = screen.getByRole('link', { name: /Занятия/ });
    expect(lessonsLink).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Профиль/ })).not.toHaveAttribute('aria-current');
  });
});

describe('MobileHeader active state', () => {
  it('highlights notifications icon on /notifications', () => {
    render(
      <MemoryRouter initialEntries={['/notifications']}>
        <MobileHeader notifBadge={0} />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: /Уведомления/ });
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(link.className).toMatch(/bg-brand-muted/);
    expect(link.className).toMatch(/text-brand/);
  });

  it('highlights assignments icon on /assignments sub-routes', () => {
    render(
      <MemoryRouter initialEntries={['/assignments/create']}>
        <MobileHeader showAssignments assignmentsBadge={0} notifBadge={0} />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: /Домашние задания/ });
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(link.className).toMatch(/bg-brand-muted/);
    expect(link.className).toMatch(/text-brand/);
    expect(screen.getByRole('link', { name: /Уведомления/ })).not.toHaveAttribute('aria-current');
  });
});

describe('MobileHeader notifications bell', () => {
  it('shows notifications bell link when unread is 0', () => {
    render(
      <MemoryRouter>
        <MobileHeader notifBadge={0} />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: /Уведомления/ });
    expect(link).toHaveAttribute('href', '/notifications');
    expect(link.querySelector('.rounded-full.bg-brand')).toBeNull();
  });

  it('shows unread badge only when unread > 0', () => {
    render(
      <MemoryRouter>
        <MobileHeader notifBadge={3} />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: /Уведомления, 3 непрочитанных/ });
    expect(link).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});

describe('MobileHeader assignments icon', () => {
  it('shows assignments link when enabled', () => {
    render(
      <MemoryRouter>
        <MobileHeader showAssignments assignmentsBadge={0} notifBadge={0} />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: /Домашние задания/ });
    expect(link).toHaveAttribute('href', '/assignments');
    expect(link.querySelector('.rounded-full.bg-brand')).toBeNull();
  });

  it('hides assignments link by default', () => {
    render(
      <MemoryRouter>
        <MobileHeader notifBadge={0} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('link', { name: /Домашние задания/ })).not.toBeInTheDocument();
  });

  it('shows assignments badge when pending > 0', () => {
    render(
      <MemoryRouter>
        <MobileHeader showAssignments assignmentsBadge={2} notifBadge={0} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /Домашние задания, 2 материалов/ })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});

describe('SidebarNav has no notifications nav item', () => {
  beforeEach(() => {
    mockUser = studentUser;
  });

  it('does not render notifications link in sidebar', () => {
    render(
      <MemoryRouter>
        <SidebarNav chatBadge={0} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('link', { name: /Уведомления/ })).not.toBeInTheDocument();
  });
});

describe('SidebarNav active state', () => {
  beforeEach(() => {
    mockUser = studentUser;
  });

  it('marks current page with aria-current', () => {
    render(
      <MemoryRouter initialEntries={['/lessons']}>
        <SidebarNav chatBadge={0} />
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
        <SidebarNav chatBadge={0} />
      </MemoryRouter>,
    );

    const adminLink = screen.getByRole('link', { name: /Админ/ });
    expect(adminLink).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Главная/ })).not.toHaveAttribute('aria-current');
  });
});
