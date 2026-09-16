import type { Message } from '@/types';

export type MessagesInfiniteData = {
  pages: { messages: Message[]; hasMore: boolean; nextCursor?: string }[];
  pageParams?: unknown[];
};

function sameSystemEvent(a: Message, b: Message): boolean {
  const as = a.metadata?.system;
  const bs = b.metadata?.system;
  if (!as || !bs) return false;
  return (
    as.event === bs.event &&
    (as.targetUserId ?? '') === (bs.targetUserId ?? '') &&
    (as.actorId ?? '') === (bs.actorId ?? '')
  );
}

/** Upsert a message into infinite-query pages (page 0 = newest window). */
export function upsertMessageInInfiniteCache(
  old: MessagesInfiniteData | null | undefined,
  message: Message,
): MessagesInfiniteData {
  if (!old?.pages?.length) {
    return { pages: [{ messages: [message], hasMore: false }], pageParams: [undefined] };
  }

  const pages = old.pages.map((page) => ({ ...page, messages: [...page.messages] }));
  const matchIndex = (msgs: Message[]) =>
    msgs.findIndex(
      (m) =>
        m.id === message.id ||
        (!!message.clientMutationId &&
          (m.clientMutationId === message.clientMutationId || m.id === message.clientMutationId)) ||
        (!!m.clientMutationId?.startsWith('optimistic-') && sameSystemEvent(m, message)),
    );

  for (let i = 0; i < pages.length; i += 1) {
    const idx = matchIndex(pages[i]!.messages);
    if (idx >= 0) {
      const prev = pages[i]!.messages[idx]!;
      pages[i]!.messages[idx] = {
        ...prev,
        ...message,
        clientMutationId: message.clientMutationId ?? prev.clientMutationId,
      };
      return { ...old, pages };
    }
  }

  pages[0] = {
    ...pages[0]!,
    messages: [...pages[0]!.messages, message],
  };
  return { ...old, pages };
}

export function appendMessagesInInfiniteCache(
  old: MessagesInfiniteData | null | undefined,
  messages: Message[],
): MessagesInfiniteData {
  return messages.reduce<MessagesInfiniteData>(
    (acc, msg) => upsertMessageInInfiniteCache(acc, msg),
    old ?? { pages: [{ messages: [], hasMore: false }], pageParams: [undefined] },
  );
}
