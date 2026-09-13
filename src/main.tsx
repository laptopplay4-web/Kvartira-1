import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from './app/providers';
import { initPortraitOrientationLock } from './services/pwa/orientation';
import { initThemePreference } from './services/theme/constants';
import './styles/globals.css';

initThemePreference();
initPortraitOrientationLock();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center text-text-muted">Загрузка…</div>}>
      <AppProviders />
    </Suspense>
  </StrictMode>,
);
