import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { BackLink } from '@/components/ui/BackLink';
import { canNavigateBack } from '@/utils/backNavigation';

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

describe('canNavigateBack', () => {
  const originalState = window.history.state;

  beforeEach(() => {
    window.history.replaceState(originalState, '');
  });

  it('returns true when history idx > 0', () => {
    window.history.replaceState({ idx: 2 }, '');
    expect(canNavigateBack()).toBe(true);
  });

  it('returns false when history idx is 0', () => {
    window.history.replaceState({ idx: 0 }, '');
    expect(canNavigateBack()).toBe(false);
  });

  it('returns false when idx is missing', () => {
    window.history.replaceState({}, '');
    expect(canNavigateBack()).toBe(false);
  });
});

describe('BackLink', () => {
  const originalState = window.history.state;

  beforeEach(() => {
    window.history.replaceState(originalState, '');
  });

  it('navigates to fallback when no history', async () => {
    window.history.replaceState({ idx: 0 }, '');
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/lessons/lesson-1']}>
        <Routes>
          <Route path="/lessons/:id" element={<BackLink label="К занятиям" fallbackTo="/lessons" />} />
          <Route path="/lessons" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /К занятиям/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/lessons');
  });

  it('uses history back when idx > 0', async () => {
    window.history.replaceState({ idx: 1 }, '');
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/home', '/lessons/lesson-1']} initialIndex={1}>
        <Routes>
          <Route path="/home" element={<LocationDisplay />} />
          <Route
            path="/lessons/:id"
            element={
              <>
                <BackLink label="Назад" fallbackTo="/lessons" />
                <LocationDisplay />
              </>
            }
          />
          <Route path="/lessons" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('location')).toHaveTextContent('/lessons/lesson-1');
    await user.click(screen.getByRole('button', { name: /Назад/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/home');
  });
});
