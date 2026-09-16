import { useEffect, useState, type ReactNode } from 'react';
import {
  dehydrate,
  hydrate,
  type DehydratedState,
  type Query,
  type QueryClient,
} from '@tanstack/react-query';
import { queryClient } from './queryClient';

/** localStorage key for dehydrated TanStack Query cache (cold start / PWA resume). */
export const QUERY_CACHE_STORAGE_KEY = 'kvartira-query-cache';

/** Keep restored shell data up to 24h; stale queries still revalidate in background. */
export const QUERY_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24;

const PERSIST_THROTTLE_MS = 1000;

const PERSIST_ROOT_KEYS = new Set([
  'conversations',
  'conversation',
  'chat-unread',
  'notifications',
  'lessons',
  'events',
  'assignments',
  'assignment-groups',
  'directions',
  'teachers',
  'users',
  'school-settings',
]);

/** Heavy / sensitive / ephemeral — never write to localStorage. */
const SKIP_PERSIST_ROOT_KEYS = new Set([
  'messages',
  'security',
  'members',
  'pinned-messages',
  'chat-search',
  'support',
  'legal',
  'slots',
  'public',
  'registration-invite',
  'progress',
]);

export interface PersistedQueryCache {
  timestamp: number;
  clientState: DehydratedState;
}

export function shouldPersistQuery(query: Query): boolean {
  if (query.state.status !== 'success') return false;
  const root = query.queryKey[0];
  if (typeof root !== 'string') return false;
  if (SKIP_PERSIST_ROOT_KEYS.has(root)) return false;
  return PERSIST_ROOT_KEYS.has(root);
}

function canUseLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

export function readPersistedQueryCache(): PersistedQueryCache | null {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(QUERY_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedQueryCache;
    if (!parsed?.timestamp || !parsed.clientState) return null;
    if (Date.now() - parsed.timestamp > QUERY_CACHE_MAX_AGE_MS) {
      window.localStorage.removeItem(QUERY_CACHE_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    try {
      window.localStorage.removeItem(QUERY_CACHE_STORAGE_KEY);
    } catch {
      // ignore
    }
    return null;
  }
}

export function writePersistedQueryCache(client: QueryClient): void {
  if (!canUseLocalStorage()) return;
  try {
    const clientState = dehydrate(client, {
      shouldDehydrateQuery: shouldPersistQuery,
    });
    const payload: PersistedQueryCache = {
      timestamp: Date.now(),
      clientState,
    };
    window.localStorage.setItem(QUERY_CACHE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota / private mode — ignore
  }
}

export function removePersistedQueryCache(): void {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.removeItem(QUERY_CACHE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function restorePersistedQueryCache(client: QueryClient = queryClient): boolean {
  const cached = readPersistedQueryCache();
  if (!cached) return false;
  try {
    hydrate(client, cached.clientState);
    return true;
  } catch {
    removePersistedQueryCache();
    return false;
  }
}

/** Clear in-memory + persisted cache (login / logout / role change). */
export async function clearAppQueryCache(): Promise<void> {
  queryClient.clear();
  removePersistedQueryCache();
}

/**
 * Restores dehydrated RQ cache once (sync), then throttles writes on cache updates.
 * Uses only `@tanstack/react-query` dehydrate/hydrate — no extra packages.
 */
export function QueryCachePersistBridge({ children }: { children: ReactNode }) {
  useState(() => {
    restorePersistedQueryCache(queryClient);
    return true;
  });

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let scheduled = false;

    const schedulePersist = () => {
      if (scheduled) return;
      scheduled = true;
      timeoutId = setTimeout(() => {
        scheduled = false;
        writePersistedQueryCache(queryClient);
      }, PERSIST_THROTTLE_MS);
    };

    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      schedulePersist();
    });

    return () => {
      unsubscribe();
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, []);

  return children;
}
