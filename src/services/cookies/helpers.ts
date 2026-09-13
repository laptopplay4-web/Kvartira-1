import {
  COOKIE_CONSENT_STORAGE_KEY,
  COOKIE_CONSENT_VERSION,
} from '@/services/cookies/constants';
import type {
  CookieConsentDecision,
  CookieConsentPreferences,
} from '@/services/cookies/types';

export type { CookieConsentDecision, CookieConsentPreferences };

interface StoredCookieConsent {
  version: string;
  essential: true;
  analytics: boolean;
  marketing: boolean;
  decidedAt: string;
}

/** Defaults while the user has not decided yet (banner visible). */
export function getDefaultCookieDraft(): Pick<
  CookieConsentPreferences,
  'essential' | 'analytics' | 'marketing'
> {
  return {
    essential: true,
    analytics: false,
    marketing: false,
  };
}

function buildPreferences(
  analytics: boolean,
  marketing: boolean,
): CookieConsentPreferences {
  return {
    essential: true,
    analytics,
    marketing,
    decidedAt: new Date().toISOString(),
  };
}

export function preferencesFromDecision(
  decision: CookieConsentDecision,
): CookieConsentPreferences {
  if (decision.kind === 'accept-all') {
    return buildPreferences(true, true);
  }
  if (decision.kind === 'reject-optional') {
    return buildPreferences(false, false);
  }
  return buildPreferences(decision.analytics, decision.marketing);
}

function parseStored(raw: string | null): CookieConsentPreferences | null {
  if (!raw) return null;

  // Legacy plain version string ("1") — force re-consent under v2 categories.
  if (!raw.startsWith('{')) {
    return null;
  }

  try {
    const data = JSON.parse(raw) as Partial<StoredCookieConsent>;
    if (data.version !== COOKIE_CONSENT_VERSION) return null;
    if (data.essential !== true) return null;
    if (typeof data.analytics !== 'boolean') return null;
    if (typeof data.marketing !== 'boolean') return null;
    if (typeof data.decidedAt !== 'string' || !data.decidedAt) return null;
    return {
      essential: true,
      analytics: data.analytics,
      marketing: data.marketing,
      decidedAt: data.decidedAt,
    };
  } catch {
    return null;
  }
}

/** Returns saved preferences or null if the user has not decided yet. */
export function getCookieConsentPreferences(): CookieConsentPreferences | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return parseStored(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** True when a durable decision exists (banner should stay hidden). */
export function hasCookieConsentDecision(): boolean {
  return getCookieConsentPreferences() !== null;
}

/** @deprecated Use hasCookieConsentDecision / getCookieConsentPreferences. */
export function hasAcceptedCookieConsent(): boolean {
  return hasCookieConsentDecision();
}

export function saveCookieConsentPreferences(
  preferences: CookieConsentPreferences,
): void {
  if (typeof localStorage === 'undefined') return;
  const payload: StoredCookieConsent = {
    version: COOKIE_CONSENT_VERSION,
    essential: true,
    analytics: preferences.analytics,
    marketing: preferences.marketing,
    decidedAt: preferences.decidedAt,
  };
  try {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* private mode / quota — banner may reappear */
  }
}

/** Persist a decision and return the stored preferences object. */
export function decideCookieConsent(
  decision: CookieConsentDecision,
): CookieConsentPreferences {
  const preferences = preferencesFromDecision(decision);
  saveCookieConsentPreferences(preferences);
  return preferences;
}

/** @deprecated Prefer decideCookieConsent({ kind: 'accept-all' }). */
export function acceptCookieConsent(): void {
  decideCookieConsent({ kind: 'accept-all' });
}

/** Public legal docs must be readable before cookie decision. */
export function isCookieConsentExemptPath(pathname: string): boolean {
  return pathname === '/legal' || pathname.startsWith('/legal/');
}
