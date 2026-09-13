import { Outlet, useLocation } from 'react-router-dom';
import { CookieConsentBanner } from '@/components/legal/CookieConsentBanner';
import { useCookieConsent } from '@/hooks/useCookieConsent';
import { isCookieConsentExemptPath } from '@/services/cookies/helpers';

/**
 * Root-route host: bottom cookie banner everywhere except public `/legal/*`
 * so the privacy policy stays readable before a decision.
 */
export function CookieConsentHost() {
  const { pathname } = useLocation();
  const consent = useCookieConsent();
  const open = consent.showBanner && !isCookieConsentExemptPath(pathname);

  return (
    <>
      <Outlet />
      <CookieConsentBanner
        open={open}
        settingsOpen={consent.settingsOpen}
        draft={consent.draft}
        onAcceptAll={consent.acceptAll}
        onRejectOptional={consent.rejectOptional}
        onOpenSettings={consent.openSettings}
        onCloseSettings={consent.closeSettings}
        onAnalyticsChange={consent.setAnalytics}
        onMarketingChange={consent.setMarketing}
        onSaveSettings={consent.saveSettings}
      />
    </>
  );
}
