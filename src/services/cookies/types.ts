/** Persisted cookie consent choice (GDPR categories). */
export interface CookieConsentPreferences {
  /** Always true — session, auth, security. Cannot be turned off. */
  essential: true;
  /** Yandex Metrika / Google Analytics etc. */
  analytics: boolean;
  /** Ads / remarketing pixels. */
  marketing: boolean;
  /** ISO timestamp of the user's decision. */
  decidedAt: string;
}

export type CookieConsentDecision =
  | { kind: 'accept-all' }
  | { kind: 'reject-optional' }
  | { kind: 'custom'; analytics: boolean; marketing: boolean };
