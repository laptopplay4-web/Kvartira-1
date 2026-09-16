import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  invalidateQueryKeys,
  restoreQuerySnapshots,
  snapshotQueries,
} from '@/utils/optimisticMutation';
import { prefetchRouteData } from '@/services/nav/prefetch';
import {
  applyCookieConsentScripts,
  resetCookieScriptLoadState,
} from '@/services/cookies/analytics';
import {
  isWebVitalsStarted,
  resetWebVitalsStarted,
} from '@/services/perf/webVitals';
import type { User } from '@/types';

describe('optimisticMutation helpers', () => {
  it('snapshots and restores query cache', async () => {
    const client = new QueryClient();
    const key = ['demo', 'a'] as const;
    client.setQueryData(key, { value: 1 });
    const snapshots = await snapshotQueries(client, [key]);
    client.setQueryData(key, { value: 2 });
    expect(client.getQueryData(key)).toEqual({ value: 2 });
    restoreQuerySnapshots(client, [key], snapshots);
    expect(client.getQueryData(key)).toEqual({ value: 1 });
  });

  it('invalidateQueryKeys triggers invalidate without throwing', () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, 'invalidateQueries');
    invalidateQueryKeys(client, [['a'], ['b', 1]]);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe('prefetchRouteData', () => {
  const student: User = {
    id: 'user-student',
    phone: '+79001111111',
    firstName: 'Аня',
    lastName: 'Ученик',
    role: 'student',
    directionIds: [],
  };

  it('no-ops without user', () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, 'prefetchQuery');
    prefetchRouteData(client, '/chat', null);
    expect(spy).not.toHaveBeenCalled();
  });

  it('prefetches conversations for /chat', () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, 'prefetchQuery').mockResolvedValue(undefined as never);
    prefetchRouteData(client, '/chat', student);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['conversations', student.id] }),
    );
  });
});

describe('web vitals behind analytics consent', () => {
  beforeEach(() => {
    resetCookieScriptLoadState();
    resetWebVitalsStarted();
  });

  it('does not start without analytics preference', () => {
    applyCookieConsentScripts({
      essential: true,
      analytics: false,
      marketing: false,
      decidedAt: new Date().toISOString(),
    });
    expect(isWebVitalsStarted()).toBe(false);
  });

  it('starts when analytics allowed', async () => {
    applyCookieConsentScripts({
      essential: true,
      analytics: true,
      marketing: false,
      decidedAt: new Date().toISOString(),
    });
    // startWebVitals is async dynamic import
    await vi.waitFor(() => {
      expect(isWebVitalsStarted()).toBe(true);
    });
  });
});
