/**
 * Lightweight RUM (LCP / INP / CLS) via web-vitals.
 * Only start after analytics cookie consent — see applyCookieConsentScripts.
 */

let started = false;

export type WebVitalMetric = {
  name: string;
  value: number;
  id: string;
  rating?: string;
};

function reportMetric(metric: WebVitalMetric): void {
  if (import.meta.env.DEV) {
    console.info('[perf]', metric.name, Math.round(metric.value), metric.rating ?? '');
  }
  // Hook for Metrika/GA when real counters replace analytics placeholders.
  const w = window as Window & {
    gtag?: (...args: unknown[]) => void;
    ym?: (id: number, method: string, ...args: unknown[]) => void;
  };
  if (typeof w.gtag === 'function') {
    w.gtag('event', metric.name, {
      value: Math.round(metric.value),
      event_category: 'Web Vitals',
      event_label: metric.id,
      non_interaction: true,
    });
  }
}

/** Start collecting web vitals once per page load. Idempotent. */
export async function startWebVitals(): Promise<void> {
  if (started || typeof window === 'undefined') return;
  started = true;
  try {
    const { onCLS, onINP, onLCP } = await import('web-vitals');
    onLCP((m) => reportMetric(m));
    onINP((m) => reportMetric(m));
    onCLS((m) => reportMetric(m));
  } catch {
    started = false;
  }
}

/** Test helper. */
export function resetWebVitalsStarted(): void {
  started = false;
}

/** Test helper. */
export function isWebVitalsStarted(): boolean {
  return started;
}
