import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import {
  PWA_INSTALL_DISMISS_COOLDOWN_MS,
  PWA_INSTALL_DISMISS_KEY,
  PWA_INSTALL_SHOW_DELAY_MS,
} from '@/services/pwa/constants';
import {
  canShowInstallBanner,
  isPwaInstalled,
  recordInstallPromptDismissal,
  wasInstallPromptDismissedRecently,
} from '@/services/pwa/helpers';
import { PwaInstallBanner } from '@/components/ui/PwaInstallBanner';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { renderHook } from '@testing-library/react';

describe('pwa helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('detects standalone display mode as installed', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: true }),
    );
    expect(isPwaInstalled()).toBe(true);
  });

  it('detects iOS standalone as installed', () => {
    Object.defineProperty(window.navigator, 'standalone', {
      configurable: true,
      value: true,
    });
    expect(isPwaInstalled()).toBe(true);
    Object.defineProperty(window.navigator, 'standalone', {
      configurable: true,
      value: undefined,
    });
  });

  it('respects dismiss cooldown', () => {
    expect(wasInstallPromptDismissedRecently()).toBe(false);

    localStorage.setItem(
      PWA_INSTALL_DISMISS_KEY,
      String(Date.now() - PWA_INSTALL_DISMISS_COOLDOWN_MS + 1000),
    );
    expect(wasInstallPromptDismissedRecently()).toBe(true);

    localStorage.setItem(
      PWA_INSTALL_DISMISS_KEY,
      String(Date.now() - PWA_INSTALL_DISMISS_COOLDOWN_MS - 1000),
    );
    expect(wasInstallPromptDismissedRecently()).toBe(false);
  });

  it('recordInstallPromptDismissal stores timestamp', () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    recordInstallPromptDismissal();
    expect(localStorage.getItem(PWA_INSTALL_DISMISS_KEY)).toBe(String(now));
  });

  it('canShowInstallBanner checks prompt, install state and dismiss', () => {
    expect(canShowInstallBanner(false)).toBe(false);
    expect(canShowInstallBanner(true)).toBe(true);

    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: true }),
    );
    expect(canShowInstallBanner(true)).toBe(false);

    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: false }),
    );
    recordInstallPromptDismissal();
    expect(canShowInstallBanner(true)).toBe(false);
  });
});

describe('PwaInstallBanner', () => {
  it('renders install and dismiss actions', () => {
    const onInstall = vi.fn();
    const onDismiss = vi.fn();

    render(<PwaInstallBanner onInstall={onInstall} onDismiss={onDismiss} />);

    expect(screen.getByRole('region', { name: 'Установка приложения' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Установить' }));
    fireEvent.click(screen.getByRole('button', { name: 'Не сейчас' }));
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));

    expect(onInstall).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });
});

describe('usePwaInstall', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows banner after delay when beforeinstallprompt fires', () => {
    const { result } = renderHook(() => usePwaInstall());

    expect(result.current.showBanner).toBe(false);

    const event = new Event('beforeinstallprompt') as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
    };
    event.prompt = vi.fn();
    event.userChoice = Promise.resolve({ outcome: 'accepted' });

    act(() => {
      window.dispatchEvent(event);
      vi.advanceTimersByTime(PWA_INSTALL_SHOW_DELAY_MS);
    });

    expect(result.current.showBanner).toBe(true);
  });

  it('hides banner and records dismiss on dismissPrompt', () => {
    const { result } = renderHook(() => usePwaInstall());

    const event = new Event('beforeinstallprompt') as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
    };
    event.prompt = vi.fn();
    event.userChoice = Promise.resolve({ outcome: 'dismissed' });

    act(() => {
      window.dispatchEvent(event);
      vi.advanceTimersByTime(PWA_INSTALL_SHOW_DELAY_MS);
    });

    expect(result.current.showBanner).toBe(true);

    act(() => {
      result.current.dismissPrompt();
    });

    expect(result.current.showBanner).toBe(false);
    expect(localStorage.getItem(PWA_INSTALL_DISMISS_KEY)).toBeTruthy();
  });
});
