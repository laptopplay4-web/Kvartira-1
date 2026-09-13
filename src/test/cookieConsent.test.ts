import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  COOKIE_CONSENT_STORAGE_KEY,
  COOKIE_CONSENT_VERSION,
} from '@/services/cookies/constants';
import {
  applyCookieConsentScripts,
  getCookieScriptLoadState,
  resetCookieScriptLoadState,
} from '@/services/cookies/analytics';
import {
  decideCookieConsent,
  getCookieConsentPreferences,
  hasCookieConsentDecision,
  isCookieConsentExemptPath,
  preferencesFromDecision,
} from '@/services/cookies/helpers';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('cookie consent helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    resetCookieScriptLoadState();
  });

  afterEach(() => {
    localStorage.clear();
    resetCookieScriptLoadState();
  });

  it('has no decision until accept-all / reject / custom save', () => {
    expect(hasCookieConsentDecision()).toBe(false);
    expect(getCookieConsentPreferences()).toBeNull();

    decideCookieConsent({ kind: 'accept-all' });
    expect(hasCookieConsentDecision()).toBe(true);
    expect(getCookieConsentPreferences()).toEqual(
      expect.objectContaining({
        essential: true,
        analytics: true,
        marketing: true,
      }),
    );
    const raw = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    expect(raw).toContain(COOKIE_CONSENT_VERSION);
  });

  it('reject-optional stores essential-only preferences', () => {
    decideCookieConsent({ kind: 'reject-optional' });
    expect(getCookieConsentPreferences()).toEqual(
      expect.objectContaining({
        essential: true,
        analytics: false,
        marketing: false,
      }),
    );
  });

  it('custom decision keeps chosen categories; essential always true', () => {
    const prefs = preferencesFromDecision({
      kind: 'custom',
      analytics: true,
      marketing: false,
    });
    expect(prefs.essential).toBe(true);
    expect(prefs.analytics).toBe(true);
    expect(prefs.marketing).toBe(false);
  });

  it('ignores legacy plain version string and shows banner again', () => {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, '1');
    expect(hasCookieConsentDecision()).toBe(false);
  });

  it('exempts public legal paths so policy is readable before accept', () => {
    expect(isCookieConsentExemptPath('/legal')).toBe(true);
    expect(isCookieConsentExemptPath('/legal/legal-privacy')).toBe(true);
    expect(isCookieConsentExemptPath('/')).toBe(false);
    expect(isCookieConsentExemptPath('/register')).toBe(false);
    expect(isCookieConsentExemptPath('/profile/legal')).toBe(false);
  });

  it('loads analytics/marketing placeholders only when allowed', () => {
    applyCookieConsentScripts({
      essential: true,
      analytics: false,
      marketing: false,
      decidedAt: new Date().toISOString(),
    });
    expect(getCookieScriptLoadState()).toEqual({
      analyticsLoaded: false,
      marketingLoaded: false,
    });

    applyCookieConsentScripts({
      essential: true,
      analytics: true,
      marketing: false,
      decidedAt: new Date().toISOString(),
    });
    expect(getCookieScriptLoadState()).toEqual({
      analyticsLoaded: true,
      marketingLoaded: false,
    });

    applyCookieConsentScripts({
      essential: true,
      analytics: true,
      marketing: true,
      decidedAt: new Date().toISOString(),
    });
    expect(getCookieScriptLoadState()).toEqual({
      analyticsLoaded: true,
      marketingLoaded: true,
    });

    // Idempotent — flags stay true, loaders are not re-entered via flag guard
    applyCookieConsentScripts({
      essential: true,
      analytics: true,
      marketing: true,
      decidedAt: new Date().toISOString(),
    });
    expect(getCookieScriptLoadState()).toEqual({
      analyticsLoaded: true,
      marketingLoaded: true,
    });
  });
});

describe('cookie consent wiring', () => {
  it('router hosts bottom banner with GDPR actions', () => {
    const router = readFileSync(resolve(process.cwd(), 'src/app/router.tsx'), 'utf8');
    const host = readFileSync(
      resolve(process.cwd(), 'src/components/legal/CookieConsentHost.tsx'),
      'utf8',
    );
    const banner = readFileSync(
      resolve(process.cwd(), 'src/components/legal/CookieConsentBanner.tsx'),
      'utf8',
    );
    const constants = readFileSync(
      resolve(process.cwd(), 'src/services/cookies/constants.ts'),
      'utf8',
    );
    const registerPage = readFileSync(
      resolve(process.cwd(), 'src/pages/auth/RegisterPage.tsx'),
      'utf8',
    );
    expect(router).toContain('CookieConsentHost');
    expect(host).toContain('CookieConsentBanner');
    expect(host).toContain('isCookieConsentExemptPath');
    expect(banner).toContain('onAcceptAll');
    expect(banner).toContain('onRejectOptional');
    expect(banner).toContain('onOpenSettings');
    expect(constants).toContain('Принять все');
    expect(constants).toContain('Отклонить необязательные');
    expect(constants).toContain('Настройки');
    expect(registerPage).toContain('getRegistrationConsentTitle');
    expect(registerPage).not.toContain('optionalDocs.map');
    expect(registerPage).not.toContain('acceptedCookies');
  });
});
