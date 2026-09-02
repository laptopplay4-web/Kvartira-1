import type { ReactNode } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { RouteErrorPage } from '@/app/RouteErrorPage';

function BrokenPage(): ReactNode {
  throw new Error('Test boom');
}

describe('RouteErrorPage', () => {
  it('renders error message with selectable alert panel', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <BrokenPage />,
          errorElement: <RouteErrorPage />,
        },
      ],
      { initialEntries: ['/'] },
    );

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveClass('app-error-panel', 'select-text');
    });
    expect(screen.getByText('Test boom')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Обновить' })).toBeInTheDocument();
  });
});
