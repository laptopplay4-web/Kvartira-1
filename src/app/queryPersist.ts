import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import type { Query } from '@tanstack/react-query';
import { queryClient } from './queryClient';

/** localStorage key for dehydrated TanStack Query cache (cold start / PWA resume). */
export const QUERY_CACHE_STORAGE_KEY = 'kvartira-query-cache';

/** Keep restored shell data up to 24h; stale queries still revalidate in background. */
export const QUERY_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24;

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

export function shouldPersistQuery(query: Query): boolean {
  if (query.state.status !== 'success') return false;
  const root = query.queryKey[0];
  if (typeof root !== 'string') return false;
  if (SKIP_PERSIST_ROOT_KEYS.has(root)) return false;
  return PERSIST_ROOT_KEYS.has(root);
}

function createNoopPersister(): Persister {
  return {
    persistClient: async () => undefined,
    restoreClient: async () => undefined,
    removeClient: async () => undefined,
  };
}

function createBrowserPersister(): Persister {
  try {
    return createSyncStoragePersister({
      storage: window.localStorage,
      key: QUERY_CACHE_STORAGE_KEY,
      throttleTime: 1000,
    });
  } catch {
    return createNoopPersister();
  }
}

export const queryPersister: Persister =
  typeof window === 'undefined' ? createNoopPersister() : createBrowserPersister();

export const queryPersistOptions = {
  persister: queryPersister,
  maxAge: QUERY_CACHE_MAX_AGE_MS,
  dehydrateOptions: {
    shouldDehydrateQuery: shouldPersistQuery,
  },
};

/** Clear in-memory + persisted cache (login / logout / role change). */
export async function clearAppQueryCache(): Promise<void> {
  queryClient.clear();
  try {
    await queryPersister.removeClient();
  } catch {
    // ignore storage failures
  }
}

/** Test helper: restore path shape. */
export type { PersistedClient };
