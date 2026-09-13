import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BottomNav, SidebarNav } from '@/components/ui/BottomNav';
import { MobileHeader } from '@/components/ui/MobileHeader';
import type { User } from '@/types';

const studentUser: User = {
  id: 'user-student',
  role: 'student',
  firstName: 'Анна',
  lastName: 'Иванова',
  phone: '+79001111111',
};

const adminUser: User = {
  id: 'user-admin',
  role: 'admin',
  firstName: 'Админ',
  lastName: 'Школы',
  phone: '+79009999999',
};

let mockUser: User = studentUser;

vi.mock('@/stores/authStore', () => ({
  useCurrentUser: () => mockUser,
}));

vi.mock('@/services/api', () => ({
  api: {
    schoolSettings: {
      getSchoolSettings: vi.fn().mockResolvedValue({
        name: 'Квартира',
        tagline: 'Школа музыки и вокала',
        about: '«Квартира» — пространство для музыки.',
        contacts: {
          phone: '+7 (900) 123-45-67',
          email: 'hello@kvartira-music.ru',
          address: 'г. Москва, ул. Музыкальная, 12',
          workingHours: 'Пн–Сб: 10:00–20:00',
        },
        socialLinks: {
          vk: 'https://vk.com/kvartira',
          telegram: 'https://t.me/kvartira',
          youtube: '',
          website: 'https://kvartira-music.ru',
          twoGis: '',
          yandexMaps: '',
        },
        directionsVideo: {
          url: 'data:video/mp4;base64,AAAA',
          filename: 'route.mp4',
          mimeType: 'video/mp4',
          size: 100,
        },
      }),
    },
  },
}));

function renderWithProviders(ui: React.ReactElement, route = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BottomNav active state', () => {
  it('highlights active item with brand palette', () => {
    renderWithProviders(<BottomNav chatBadge={0} />, '/chat');

    const chatLink = screen.getByRole('link', { name: /Чат/ });
    expect(chatLink).toHaveAttribute('aria-current', 'page');
    expect(chatLink.className).toMatch(/text-brand/);
    expect(chatLink.className).not.toMatch(/bg-brand-muted/);
    expect(screen.getByRole('link', { name: /Главная/ })).not.toHaveAttribute('aria-current');
  });

  it('highlights lessons on /lessons/availability', () => {
    renderWithProviders(<BottomNav chatBadge={0} />, '/lessons/availability');

    const lessonsLink = screen.getByRole('link', { name: /Занятия/ });
    expect(lessonsLink).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Профиль/ })).not.toHaveAttribute('aria-current');
  });

  it('shows profile badge when provided', () => {
    renderWithProviders(<BottomNav chatBadge={0} profileBadge={3} />, '/home');
    const profileLink = screen.getByRole('link', { name: /Профиль/ });
    expect(profileLink).toHaveTextContent('3');
  });
});

describe('MobileHeader active state', () => {
  it('highlights notifications icon on /notifications', () => {
    renderWithProviders(<MobileHeader notifBadge={0} />, '/notifications');

    const link = screen.getByRole('link', { name: /Уведомления/ });
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(link.className).toMatch(/bg-brand-muted/);
    expect(link.className).toMatch(/text-brand/);
  });

  it('highlights assignments icon on /assignments sub-routes', () => {
    renderWithProviders(
      <MobileHeader showAssignments assignmentsBadge={0} notifBadge={0} />,
      '/assignments/create',
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
    renderWithProviders(<MobileHeader notifBadge={0} />);

    const link = screen.getByRole('link', { name: /Уведомления/ });
    expect(link).toHaveAttribute('href', '/notifications');
    expect(link.querySelector('.rounded-full.bg-brand')).toBeNull();
  });

  it('shows unread badge only when unread > 0', () => {
    renderWithProviders(<MobileHeader notifBadge={3} />);

    const link = screen.getByRole('link', { name: /Уведомления, 3 непрочитанных/ });
    expect(link).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});

describe('MobileHeader assignments icon', () => {
  it('shows assignments link when enabled', () => {
    renderWithProviders(<MobileHeader showAssignments assignmentsBadge={0} notifBadge={0} />);

    const link = screen.getByRole('link', { name: /Домашние задания/ });
    expect(link).toHaveAttribute('href', '/assignments');
    expect(link.querySelector('.rounded-full.bg-brand')).toBeNull();
  });

  it('hides assignments link by default', () => {
    renderWithProviders(<MobileHeader notifBadge={0} />);

    expect(screen.queryByRole('link', { name: /Домашние задания/ })).not.toBeInTheDocument();
  });

  it('shows assignments badge when pending > 0', () => {
    renderWithProviders(<MobileHeader showAssignments assignmentsBadge={2} notifBadge={0} />);

    expect(screen.getByRole('link', { name: /Домашние задания, 2 непрочитанных/ })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});

describe('School about button', () => {
  beforeEach(() => {
    mockUser = studentUser;
  });

  it('shows about school button next to logo in MobileHeader', () => {
    renderWithProviders(<MobileHeader notifBadge={0} />);
    expect(screen.getByRole('button', { name: /О школе/ })).toBeInTheDocument();
  });

  it('shows about school button next to logo in SidebarNav', () => {
    renderWithProviders(<SidebarNav chatBadge={0} />);
    expect(screen.getByRole('button', { name: /О школе/ })).toBeInTheDocument();
  });

  it('opens school info modal for any authenticated user', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MobileHeader notifBadge={0} />);

    await user.click(screen.getByRole('button', { name: /О школе/ }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(await screen.findByText('Квартира')).toBeInTheDocument();
    expect(screen.getByText(/Школа музыки и вокала/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ВКонтакте/ })).toHaveAttribute(
      'href',
      'https://vk.com/kvartira',
    );
    expect(screen.getByRole('link', { name: /Сайт школы/ })).toBeInTheDocument();
    expect(screen.getByText('Как добраться')).toBeInTheDocument();
    expect(document.querySelector('video')).toBeTruthy();
  });
});

describe('SidebarNav has no notifications nav item', () => {
  beforeEach(() => {
    mockUser = studentUser;
  });

  it('does not render notifications link in sidebar', () => {
    renderWithProviders(<SidebarNav chatBadge={0} />);

    expect(screen.queryByRole('link', { name: /Уведомления/ })).not.toBeInTheDocument();
  });
});

describe('SidebarNav active state', () => {
  beforeEach(() => {
    mockUser = studentUser;
  });

  it('marks current page with aria-current', () => {
    renderWithProviders(<SidebarNav chatBadge={0} />, '/lessons');

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
    renderWithProviders(<SidebarNav chatBadge={0} />, '/admin/schedule');

    const adminLink = screen.getByRole('link', { name: /Админ/ });
    expect(adminLink).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Главная/ })).not.toHaveAttribute('aria-current');
  });
});
