import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { User } from '@/types';

const mockGetTeacherAvailability = vi.fn();
const mockUpdateTeacherAvailability = vi.fn();

vi.mock('@/services/api', () => ({
  api: {
    availability: {
      getTeacherAvailability: (...args: unknown[]) => mockGetTeacherAvailability(...args),
      updateTeacherAvailability: (...args: unknown[]) => mockUpdateTeacherAvailability(...args),
    },
  },
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

describe('AvailabilityPage save offline', () => {
  beforeEach(() => {
    mockGetTeacherAvailability.mockResolvedValue({
      teacherId: 'teacher-1',
      slotIntervalMinutes: 30,
      defaultLessonDurationMinutes: 60,
      schedule: [{ dayOfWeek: 1, ranges: [{ start: '10:00', end: '18:00' }] }],
    });
  });

  it('disables save button when offline', async () => {
    mockUseOnlineStatus.mockReturnValue(false);
    renderAvailabilityPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Сохранить изменения' })).toBeDisabled();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Нет подключения к интернету. Проверьте соединение и попробуйте снова.',
    );
  });

  it('enables save button when online', async () => {
    mockUseOnlineStatus.mockReturnValue(true);
    renderAvailabilityPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Сохранить изменения' })).not.toBeDisabled();
    });
  });
});
