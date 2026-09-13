import type {
  Conversation,
  ConversationLastMessage,
  ConversationMember,
  Message,
  User,
} from '@/types';
import { formatUserName } from '@/utils';
import { compareIsoDates } from '@/utils/dates';
import { getAttachmentsPreviewLabel, isSyntheticMediaCaption } from './attachments';
import { LAST_MESSAGE_PREVIEW_LENGTH, MESSAGE_SEARCH_MIN_LENGTH } from './constants';
import { getMessageDisplayText } from './messages';
import { isSchoolWideConversation } from './schoolWide';

export type ChatFilter = 'all' | 'personal' | 'group' | 'school';

export function sortConversations(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort((a, b) => {
    const aTime = a.lastMessageAt ?? a.createdAt;
    const bTime = b.lastMessageAt ?? b.createdAt;
    return compareIsoDates(bTime, aTime);
  });
}

/** Pinned (for current user) first — newest pin at the very top — then by last message. */
export function sortConversationsWithPins(
  conversations: Conversation[],
  members: ConversationMember[],
  currentUserId: string,
): Conversation[] {
  const pinAt = new Map<string, string>();
  for (const m of members) {
    if (m.userId === currentUserId && m.pinnedAt) {
      pinAt.set(m.conversationId, m.pinnedAt);
    }
  }
  for (const c of conversations) {
    if (c.viewerPinnedAt) pinAt.set(c.id, c.viewerPinnedAt);
  }
  return [...conversations].sort((a, b) => {
    const aPin = pinAt.get(a.id) ?? a.viewerPinnedAt ?? undefined;
    const bPin = pinAt.get(b.id) ?? b.viewerPinnedAt ?? undefined;
    if (aPin && !bPin) return -1;
    if (!aPin && bPin) return 1;
    if (aPin && bPin) {
      // Newer pin first so a just-pinned chat always lands at position 0
      const byPin = compareIsoDates(bPin, aPin);
      if (byPin !== 0) return byPin;
      // Same pin time — still prefer fresher activity inside the pin block
    }
    const aTime = a.lastMessageAt ?? a.createdAt;
    const bTime = b.lastMessageAt ?? b.createdAt;
    return compareIsoDates(bTime, aTime);
  });
}

/** Preview row for conversation list from a message payload. */
export function conversationPreviewFromMessage(message: Message): ConversationLastMessage {
  const text =
    message.text && !isSyntheticMediaCaption(message.text, message.attachments)
      ? message.text
      : getAttachmentsPreviewLabel(message.attachments) || message.text || 'Вложение';
  return {
    id: message.id,
    text,
    senderId: message.senderId,
    createdAt: message.createdAt,
  };
}

/**
 * Messenger-style list bump: update last message + re-sort.
 * Pinned chats stay above unpinned; among unpinned, newest activity rises to top.
 * Ignores stale (older) events so out-of-order realtime cannot shuffle the list.
 */
export function bumpConversationInList(
  conversations: Conversation[],
  conversationId: string,
  patch: {
    lastMessageAt: string;
    lastMessage: ConversationLastMessage;
    unreadDelta?: number;
  },
  currentUserId: string,
): Conversation[] {
  let touched = false;
  const next = conversations.map((c) => {
    if (c.id !== conversationId) return c;
    const prevAt = c.lastMessageAt ?? c.createdAt;
    if (compareIsoDates(patch.lastMessageAt, prevAt) < 0) return c;
    touched = true;
    const unreadDelta = patch.unreadDelta ?? 0;
    return {
      ...c,
      lastMessageAt: patch.lastMessageAt,
      updatedAt: patch.lastMessageAt,
      lastMessage: patch.lastMessage,
      unreadCount: Math.max(0, (c.unreadCount ?? 0) + unreadDelta),
    };
  });
  if (!touched) return conversations;
  return sortConversationsWithPins(next, [], currentUserId);
}

export function truncatePreview(text: string, max = LAST_MESSAGE_PREVIEW_LENGTH): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

/**
 * Pinned messages in Telegram order: by position in chat, newest first
 * (from the end of the dialogue toward the start).
 */
export function orderPinnedMessagesNewestFirst(
  pinnedIds: string[],
  messages: Message[],
): Message[] {
  if (pinnedIds.length === 0) return [];
  const pinnedSet = new Set(pinnedIds);
  const byId = new Map<string, Message>();
  for (const m of messages) {
    if (pinnedSet.has(m.id) && !m.deletedAt) byId.set(m.id, m);
  }
  return [...byId.values()].sort((a, b) =>
    compareIsoDates(b.createdAt, a.createdAt),
  );
}

/**
 * Active pin for current viewport (Telegram-style).
 * `pinnedIdsNewestFirst` — newest → oldest.
 * `pinTopById` — getBoundingClientRect().top for each pin in the list.
 * `viewportTop` — top edge of the scroll viewport (sticky bar line).
 *
 * The bar shows the newest pin that has scrolled to/above the top edge;
 * scrolling up/down past pins moves the index toward older/newer.
 */
export function resolvePinnedIndexForViewport(
  pinnedIdsNewestFirst: string[],
  pinTopById: Readonly<Record<string, number | null | undefined>>,
  viewportTop: number,
): number {
  const n = pinnedIdsNewestFirst.length;
  if (n === 0) return 0;

  const oldestFirst = [...pinnedIdsNewestFirst].reverse();
  let lastPassedOldestFirst = -1;
  for (let i = 0; i < oldestFirst.length; i++) {
    const top = pinTopById[oldestFirst[i]!];
    if (top == null || Number.isNaN(top)) continue;
    if (top <= viewportTop) lastPassedOldestFirst = i;
  }
  if (lastPassedOldestFirst < 0) return n - 1;
  return n - 1 - lastPassedOldestFirst;
}

export function getConversationDisplayTitle(
  conversation: Conversation,
  currentUserId: string,
  users: User[],
): string {
  if (isGroupLike(conversation)) return conversation.title;
  const otherId = conversation.participantIds.find((id) => id !== currentUserId);
  const other = users.find((u) => u.id === otherId);
  return other ? formatUserName(other) : conversation.title;
}

export function isGroupLike(conversation: Conversation): boolean {
  return conversation.type !== 'personal';
}

export function filterConversations(
  conversations: Conversation[],
  options: {
    search?: string;
    filter?: ChatFilter;
    currentUserId: string;
    users: User[];
  },
): Conversation[] {
  const { search = '', filter = 'all', currentUserId, users } = options;
  let result = conversations;

  if (filter === 'personal') {
    result = result.filter((c) => c.type === 'personal');
  } else if (filter === 'group') {
    result = result.filter((c) => c.type !== 'personal' && !isSchoolWideConversation(c));
  } else if (filter === 'school') {
    result = result.filter((c) => isSchoolWideConversation(c));
  }

  const q = search.trim().toLowerCase();
  if (q) {
    result = result.filter((conv) => {
      const title = getConversationDisplayTitle(conv, currentUserId, users).toLowerCase();
      if (title.includes(q)) return true;
      return conv.participantIds.some((id) => {
        const u = users.find((user) => user.id === id);
        if (!u) return false;
        const name = formatUserName(u).toLowerCase();
        return (
          name.includes(q) ||
          u.firstName.toLowerCase().includes(q) ||
          u.lastName.toLowerCase().includes(q)
        );
      });
    });
  }

  // Keep viewer pins first — never fall back to last-message-only sort.
  return sortConversationsWithPins(result, [], currentUserId);
}

export function computeUnreadCount(
  conversationId: string,
  userId: string,
  messages: Message[],
  member?: ConversationMember,
): number {
  const lastReadAt = member?.lastReadAt;
  return messages.filter(
    (m) =>
      m.conversationId === conversationId &&
      m.senderId !== userId &&
      !m.deletedAt &&
      m.messageType !== 'system' &&
      (!lastReadAt || m.createdAt > lastReadAt),
  ).length;
}

export function normalizeMessageText(text: string): string {
  return text.trim();
}

export function isValidMessageText(text: string, maxLength: number): boolean {
  const normalized = normalizeMessageText(text);
  return normalized.length > 0 && normalized.length <= maxLength;
}

export interface MessageGroupItem {
  message: Message;
  showSender: boolean;
  showAvatar: boolean;
  /** First message in a visual stack (VK-style spacing). */
  clusterStart: boolean;
}

export function groupMessagesForDisplay(
  messages: Message[],
  currentUserId: string,
): MessageGroupItem[] {
  return messages.map((message, index) => {
    const prev = messages[index - 1];
    const sameSender = prev?.senderId === message.senderId && !message.replyToMessageId;
    const sameMinute =
      !!prev &&
      !message.replyToMessageId &&
      Math.abs(new Date(message.createdAt).getTime() - new Date(prev.createdAt).getTime()) <
        5 * 60_000;
    const isOwn = message.senderId === currentUserId;
    const isSystem = message.messageType === 'system';
    const clusterStart = !prev || !sameSender || !sameMinute || isSystem;
    return {
      message,
      showSender: !isOwn && !isSystem && clusterStart,
      showAvatar: !isOwn && !isSystem && clusterStart,
      clusterStart,
    };
  });
}

export interface DateSeparator {
  type: 'separator';
  key: string;
  label: string;
}

export interface MessageListItem {
  type: 'message';
  key: string;
  group: MessageGroupItem;
}

export type ChatListEntry = DateSeparator | MessageListItem;

export function buildMessageListWithSeparators(
  messages: Message[],
  currentUserId: string,
  formatSeparator: (date: string) => string,
): ChatListEntry[] {
  const items: ChatListEntry[] = [];
  let lastDateKey = '';

  for (const group of groupMessagesForDisplay(messages, currentUserId)) {
    const createdAt = group.message.createdAt ?? new Date(0).toISOString();
    const dateKey = createdAt.slice(0, 10);
    if (dateKey !== lastDateKey) {
      items.push({
        type: 'separator',
        key: `sep-${dateKey}`,
        label: formatSeparator(createdAt),
      });
      lastDateKey = dateKey;
    }
    items.push({ type: 'message', key: group.message.id, group });
  }

  return items;
}

export function formatTypingIndicator(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return `${names[0]} печатает…`;
  if (names.length === 2) return `${names[0]} и ${names[1]} печатают…`;
  return `${names[0]} и ещё ${names.length - 1} печатают…`;
}

export function getReplyPreviewText(message: Message | undefined): string {
  if (!message) return 'Сообщение недоступно';
  return getMessageDisplayText(message);
}

export function matchesMessageSearch(message: Message, query: string): boolean {
  if (message.messageType === 'system') return false;
  if (message.deletedAt) return false;
  const q = query.trim().toLowerCase();
  if (q.length < MESSAGE_SEARCH_MIN_LENGTH) return false;
  return message.text.toLowerCase().includes(q);
}

export function searchMessagesInConversations(
  messages: Message[],
  conversations: Conversation[],
  users: User[],
  _currentUserId: string,
  query: string,
): { message: Message; conversation: Conversation; senderName: string }[] {
  const q = query.trim().toLowerCase();
  if (q.length < MESSAGE_SEARCH_MIN_LENGTH) return [];

  const accessibleConvIds = new Set(conversations.map((c) => c.id));
  const results: { message: Message; conversation: Conversation; senderName: string }[] = [];

  for (const message of messages) {
    if (!accessibleConvIds.has(message.conversationId)) continue;
    if (!matchesMessageSearch(message, q)) continue;
    const conversation = conversations.find((c) => c.id === message.conversationId);
    if (!conversation) continue;
    const sender = users.find((u) => u.id === message.senderId);
    results.push({
      message,
      conversation,
      senderName: sender ? formatUserName(sender) : 'Неизвестный',
    });
  }

  return results.sort((a, b) => compareIsoDates(b.message.createdAt, a.message.createdAt));
}
