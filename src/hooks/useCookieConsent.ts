import { useCallback, useEffect, useState } from 'react';
import { applyCookieConsentScripts } from '@/services/cookies/analytics';
import {
  decideCookieConsent,
  getCookieConsentPreferences,
  getDefaultCookieDraft,
  hasCookieConsentDecision,
} from '@/services/cookies/helpers';
import type { CookieConsentDecision } from '@/services/cookies/types';

export function useCookieConsent() {
  const [decided, setDecided] = useState(() => hasCookieConsentDecision());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState(() => getDefaultCookieDraft());

  // Boot: apply scripts if a prior decision exists.
  useEffect(() => {
    applyCookieConsentScripts(getCookieConsentPreferences());
  }, []);

  const persist = useCallback((decision: CookieConsentDecision) => {
    const preferences = decideCookieConsent(decision);
    applyCookieConsentScripts(preferences);
    setDecided(true);
    setSettingsOpen(false);
  }, []);

  const acceptAll = useCallback(() => {
    persist({ kind: 'accept-all' });
  }, [persist]);

  const rejectOptional = useCallback(() => {
    persist({ kind: 'reject-optional' });
  }, [persist]);

  const openSettings = useCallback(() => {
    const saved = getCookieConsentPreferences();
    setDraft(
      saved
        ? {
            essential: true,
            analytics: saved.analytics,
            marketing: saved.marketing,
          }
        : getDefaultCookieDraft(),
    );
    setSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const setAnalytics = useCallback((analytics: boolean) => {
    setDraft((prev) => ({ ...prev, analytics }));
  }, []);

  const setMarketing = useCallback((marketing: boolean) => {
    setDraft((prev) => ({ ...prev, marketing }));
  }, []);

  const saveSettings = useCallback(() => {
    persist({
      kind: 'custom',
      analytics: draft.analytics,
      marketing: draft.marketing,
    });
  }, [draft.analytics, draft.marketing, persist]);

  return {
    /** Show banner until the user makes any durable choice. */
    showBanner: !decided,
    settingsOpen,
    draft,
    acceptAll,
    rejectOptional,
    openSettings,
    closeSettings,
    setAnalytics,
    setMarketing,
    saveSettings,
  };
}
