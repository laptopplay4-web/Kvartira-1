/**
 * Канонический imageUrl для записи в БД при update.
 * Display/signed URL с клиента не должен затирать pbfile: ref.
 */
export function resolveEventImageWriteInput(
  incoming: string | undefined,
  stored: string | undefined,
  imageProvided: boolean,
): string | undefined {
  if (!imageProvided) return stored;
  if (!incoming) return undefined;
  if (incoming.startsWith('data:') || incoming.startsWith('pbfile:')) return incoming;
  if (stored?.startsWith('pbfile:')) return stored;
  return incoming;
}
