/** Preferred lock for mobile PWA shell (matches Web App Manifest). */
export const PORTRAIT_ORIENTATION_LOCK = 'portrait' as const;

type OrientationLockFn = (orientation: typeof PORTRAIT_ORIENTATION_LOCK) => Promise<void>;

function getOrientationLock(): OrientationLockFn | null {
  if (typeof window === 'undefined' || typeof screen === 'undefined') return null;

  const orientation = screen.orientation as ScreenOrientation & {
    lock?: OrientationLockFn;
  };

  if (typeof orientation?.lock === 'function') {
    return orientation.lock.bind(orientation);
  }

  return null;
}

/**
 * Best-effort portrait lock via Screen Orientation API.
 * Installed PWAs / fullscreen contexts succeed; browser tabs often reject — never throws.
 */
export async function lockPortraitOrientation(): Promise<boolean> {
  const lock = getOrientationLock();
  if (!lock) return false;

  try {
    await lock(PORTRAIT_ORIENTATION_LOCK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Apply portrait lock on boot and re-apply when the app becomes visible again
 * (some engines drop the lock after backgrounding).
 */
export function initPortraitOrientationLock(): void {
  if (typeof window === 'undefined') return;

  const tryLock = () => {
    void lockPortraitOrientation();
  };

  tryLock();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tryLock();
  });

  window.addEventListener('pageshow', tryLock);
  window.addEventListener('orientationchange', () => {
    window.setTimeout(tryLock, 0);
  });
}
