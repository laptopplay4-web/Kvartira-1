import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BookLessonLink } from '@/components/ui/BookLessonLink';
import type { User } from '@/types';

const mockGetSchedule = vi.fn();
const mockUpdateSchedule = vi.fn();

vi.mock('@/config/features', () => ({
  isYclientsLessonsEnabled: () => true,
  YCLIENTS_LESSONS_SOURCE: 'yclients',
}));

vi.mock('@/services/api/yclientsClient', () => ({
  getYclientsApi: () => ({
    getSchedule: (...args: unknown[]) => mockGetSchedule(...args),
    updateSchedule: (...args: unknown[]) => mockUpdateSchedule(...args),
  }),
}));

const teacherUser: User = {
  id: 'teacher-1',
  role: 'teacher',
  firstName: 'Мария',
  lastName: 'Петрова',
  phone: '+79002222222',
};

vi.mock('@/stores/authStore', () => ({
  useCurrentUser: () => teacherUser,
}));

const mockUseOnlineStatus = vi.fn(() => true);

vi.mock('@/hooks/useOnlineStatus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useOnlineStatus')>();
  return {
    ...actual,
    useOnlineStatus: () => mockUseOnlineStatus(),
  };
});

import AvailabilityPage from '@/pages/profile/AvailabilityPage';

function renderAvailabilityPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AvailabilityPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BookLessonLink', () => {
  it('renders link when online', () => {
    mockUseOnlineStatus.mockReturnValue(true);
    render(
      <MemoryRouter>
        <BookLessonLink>Записаться</BookLessonLink>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Записаться' })).toHaveAttribute('href', '/lessons/book');
  });

  it('renders disabled button when offline', () => {
    mockUseOnlineStatus.mockReturnValue(false);
    render(
      <MemoryRouter>
        <BookLessonLink>Записаться</BookLessonLink>
      </MemoryRouter>,
    );

    expect(screen.queryByRole('link', { name: 'Записаться' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Записаться' })).toBeDisabled();
  });
});

describe('AvailabilityPage save offline (YCLIENTS)', () => {
  beforeEach(() => {
    mockGetSchedule.mockResolvedValue({
      staffId: 42,
      from: '2026-09-19',
      to: '2026-11-14',
      items: [
        {
          date: '2026-09-21',
          slots: [{ from: '10:00', to: '18:00' }],
          isWorking: true,
        },
      ],
    });
  });

  it('disables save button when offline', async () => {
    mockUseOnlineStatus.mockReturnValue(false);
    renderAvailabilityPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    });
    expect(
      screen.getByText(
        'Нет подключения к интернету. Проверьте соединение и попробуйте снова.',
      ),
    ).toBeInTheDocument();
  });

  it('enables save button when online', async () => {
    mockUseOnlineStatus.mockReturnValue(true);
    renderAvailabilityPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Сохранить' })).not.toBeDisabled();
    });
  });
});
