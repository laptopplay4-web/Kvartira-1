import {
  PWA_INSTALL_DISMISS_COOLDOWN_MS,
  PWA_INSTALL_DISMISS_KEY,
} from './constants';

export function isPwaInstalled(): boolean {
  if (typeof window === 'undefined') return false;

  const nav = window.navigator as Navigator & { standalone?: boolean };
  const standaloneMedia =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(display-mode: standalone)').matches
      : false;

  return standaloneMedia || nav.standalone === true;
}

export function wasInstallPromptDismissedRecently(): boolean {
  if (typeof localStorage === 'undefined') return false;

  const raw = localStorage.getItem(PWA_INSTALL_DISMISS_KEY);
  if (!raw) return false;

  const dismissedAt = Number(raw);
  if (Number.isNaN(dismissedAt)) return false;

  return Date.now() - dismissedAt < PWA_INSTALL_DISMISS_COOLDOWN_MS;
}

export function recordInstallPromptDismissal(): void {
  localStorage.setItem(PWA_INSTALL_DISMISS_KEY, String(Date.now()));
}

export function canShowInstallBanner(hasDeferredPrompt: boolean): boolean {
  if (!hasDeferredPrompt) return false;
  if (isPwaInstalled()) return false;
  if (wasInstallPromptDismissedRecently()) return false;
  return true;
}
