import type { QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Snapshot + restore helpers for TanStack Query optimistic mutations.
 * Pattern: cancel → snapshot → setQueryData → onError restore → onSettled invalidate.
 */

export type QuerySnapshots = Map<string, unknown>;

function keyId(key: QueryKey): string {
  return JSON.stringify(key);
}

/** Cancel in-flight queries and capture previous cache values. */
export async function snapshotQueries(
  queryClient: QueryClient,
  keys: QueryKey[],
): Promise<QuerySnapshots> {
  await Promise.all(keys.map((key) => queryClient.cancelQueries({ queryKey: key })));
  const snapshots: QuerySnapshots = new Map();
  for (const key of keys) {
    snapshots.set(keyId(key), queryClient.getQueryData(key));
  }
  return snapshots;
}

/** Restore cache from snapshots taken in onMutate. */
export function restoreQuerySnapshots(
  queryClient: QueryClient,
  keys: QueryKey[],
  snapshots: QuerySnapshots | undefined,
): void {
  if (!snapshots) return;
  for (const key of keys) {
    const id = keyId(key);
    if (!snapshots.has(id)) continue;
    queryClient.setQueryData(key, snapshots.get(id));
  }
}

/** Invalidate one or more query keys after settle. */
export function invalidateQueryKeys(queryClient: QueryClient, keys: QueryKey[]): void {
  for (const key of keys) {
    void queryClient.invalidateQueries({ queryKey: key });
  }
}
