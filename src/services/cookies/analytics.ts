import type { CookieConsentPreferences } from '@/services/cookies/types';
import { startWebVitals } from '@/services/perf/webVitals';

/**
 * Analytics / marketing loaders.
 *
 * Replace the bodies of `loadYandexMetrika` / `loadGoogleAnalytics` /
 * `loadMarketingTags` with real script injection when ready.
 * They MUST only be called after the user granted the matching category.
 */

let analyticsLoaded = false;
let marketingLoaded = false;

/** Placeholder: inject Yandex.Metrika when analytics is allowed. */
export function loadYandexMetrika(): void {
  // TODO: insert Metrika counter, e.g.:
  // (function(m,e,t,r,i,k,a){ ... })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
  // ym(XXXXXXXX, "init", { clickmap: true, trackLinks: true, accurateTrackBounce: true });
  if (import.meta.env.DEV) {
    console.info('[cookies] Yandex.Metrika placeholder — analytics allowed');
  }
}

/** Placeholder: inject Google Analytics / gtag when analytics is allowed. */
export function loadGoogleAnalytics(): void {
  // TODO: insert GA4, e.g.:
  // const s = document.createElement('script');
  // s.async = true;
  // s.src = 'https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXX';
  // document.head.appendChild(s);
  // window.dataLayer = window.dataLayer || [];
  // function gtag(...args: unknown[]) { window.dataLayer.push(args); }
  // gtag('js', new Date());
  // gtag('config', 'G-XXXXXXXX');
  if (import.meta.env.DEV) {
    console.info('[cookies] Google Analytics placeholder — analytics allowed');
  }
}

/** Placeholder: marketing / ads pixels when marketing is allowed. */
export function loadMarketingTags(): void {
  // TODO: insert remarketing / ads pixels here.
  if (import.meta.env.DEV) {
    console.info('[cookies] Marketing tags placeholder — marketing allowed');
  }
}

/**
 * Apply consent: load optional scripts once when allowed.
 * Call on app boot and after every new user decision.
 */
export function applyCookieConsentScripts(
  preferences: CookieConsentPreferences | null,
): void {
  if (!preferences) return;

  if (preferences.analytics && !analyticsLoaded) {
    loadYandexMetrika();
    loadGoogleAnalytics();
    void startWebVitals();
    analyticsLoaded = true;
  }

  if (preferences.marketing && !marketingLoaded) {
    loadMarketingTags();
    marketingLoaded = true;
  }

  // If the user later revokes a category, reload the page or remove tags
  // explicitly — most analytics SDKs do not fully unload without a refresh.
}

/** Test helper — in-memory load flags. */
export function getCookieScriptLoadState(): {
  analyticsLoaded: boolean;
  marketingLoaded: boolean;
} {
  return { analyticsLoaded, marketingLoaded };
}

/** Test helper — reset in-memory load flags. */
export function resetCookieScriptLoadState(): void {
  analyticsLoaded = false;
  marketingLoaded = false;
}
