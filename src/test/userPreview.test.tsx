import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { UserPreviewModal } from '@/components/users/UserPreviewModal';
import { UserPreviewProvider, useUserPreview } from '@/components/users/UserPreviewProvider';
import { UserPreviewTrigger } from '@/components/users/UserPreviewTrigger';
import {
  formatUserDirectionLabels,
  resolveUserDirections,
} from '@/services/users/helpers';
import type { User } from '@/types';
import { users } from '@/mocks/seed';

const student = users.find((u) => u.role === 'student')!;
const teacher = users.find((u) => u.role === 'teacher')!;

vi.mock('@/stores/authStore', () => ({
  useCurrentUser: () => teacher,
}));

vi.mock('@/services/api', () => ({
  api: {
    users: {
      getUser: vi.fn(async (id: string) => {
        const user = users.find((u) => u.id === id);
        if (!user) throw new Error('not found');
        return user;
      }),
    },
    lessons: {
      getDirections: vi.fn(async () => [
        { id: 'dir-vocal', name: 'Вокал' },
        { id: 'dir-guitar', name: 'Гитара' },
        { id: 'dir-piano', name: 'Фортепиано' },
      ]),
    },
  },
}));

function renderWithProviders(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <UserPreviewProvider>{ui}</UserPreviewProvider>
    </QueryClientProvider>,
  );
}

describe('user preview helpers', () => {
  it('formats and resolves direction labels in directionIds order', () => {
    const directions = [
      { id: 'dir-guitar', name: 'Гитара' },
      { id: 'dir-vocal', name: 'Вокал' },
    ];
    const user = { directionIds: ['dir-vocal', 'dir-guitar'] };
    expect(formatUserDirectionLabels(user, directions)).toBe('Вокал · Гитара');
    expect(resolveUserDirections(user, directions).map((d) => d.name)).toEqual(['Вокал', 'Гитара']);
  });

  it('returns empty when no directions', () => {
    expect(formatUserDirectionLabels({}, [{ id: 'dir-vocal', name: 'Вокал' }])).toBe('');
    expect(resolveUserDirections({}, [{ id: 'dir-vocal', name: 'Вокал' }])).toEqual([]);
  });
});

describe('UserPreviewModal', () => {
  it('shows name, role status and directions', async () => {
    const vocalStudent: User = {
      ...student,
      directionIds: ['dir-vocal', 'dir-guitar'],
    };

    const { api } = await import('@/services/api');
    vi.mocked(api.users.getUser).mockResolvedValueOnce(vocalStudent);

    renderWithProviders(
      <UserPreviewModal
        open
        userId={vocalStudent.id}
        seedUser={vocalStudent}
        requesterId={teacher.id}
        onClose={() => undefined}
      />,
    );

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(`${vocalStudent.firstName} ${vocalStudent.lastName}`)).toBeInTheDocument();
    expect(screen.getByText('Ученик')).toBeInTheDocument();
    expect(await screen.findByText('Вокал')).toBeInTheDocument();
    expect(screen.getByText('Гитара')).toBeInTheDocument();
  });

  it('opens fullscreen photo viewer when avatar photo is tapped', async () => {
    const user = userEvent.setup();
    const withPhoto: User = {
      ...student,
      avatarUrl: 'https://cdn.example.com/avatars/student.jpg',
      avatarOriginalUrl: 'https://cdn.example.com/avatars/student-full.jpg',
    };

    const { api } = await import('@/services/api');
    vi.mocked(api.users.getUser).mockResolvedValueOnce(withPhoto);

    renderWithProviders(
      <UserPreviewModal
        open
        userId={withPhoto.id}
        seedUser={withPhoto}
        requesterId={teacher.id}
        onClose={() => undefined}
      />,
    );

    await user.click(
      await screen.findByRole('button', {
        name: `Открыть фото: ${withPhoto.firstName} ${withPhoto.lastName}`,
      }),
    );

    const lightbox = await screen.findByRole('dialog', { name: 'Просмотр фото профиля' });
    expect(lightbox).toBeInTheDocument();
    expect(lightbox.querySelector('img')).toHaveAttribute(
      'src',
      'https://cdn.example.com/avatars/student-full.jpg',
    );
  });
});

describe('UserPreviewTrigger', () => {
  it('opens preview on click', async () => {
    const user = userEvent.setup();

    function Probe() {
      const { openUserPreview } = useUserPreview();
      return (
        <>
          <UserPreviewTrigger user={student}>Открыть</UserPreviewTrigger>
          <button type="button" onClick={() => openUserPreview(student.id)}>
            by-id
          </button>
        </>
      );
    }

    renderWithProviders(<Probe />);

    await user.click(
      screen.getByRole('button', { name: `Профиль: ${student.firstName} ${student.lastName}` }),
    );
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(`${student.firstName} ${student.lastName}`)).toBeInTheDocument();
  });
});
