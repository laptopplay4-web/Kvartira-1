import type { Conversation, ConversationMember, Message, User } from '@/types';
import { formatUserName } from '@/utils';
import { compareIsoDates } from '@/utils/dates';
import { LAST_MESSAGE_PREVIEW_LENGTH, MESSAGE_SEARCH_MIN_LENGTH } from './constants';
import { getMessageDisplayText } from './messages';

export type ChatFilter = 'all' | 'unread' | 'personal' | 'group';

export function sortConversations(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort((a, b) => {
    const aTime = a.lastMessageAt ?? a.createdAt;
    const bTime = b.lastMessageAt ?? b.createdAt;
    return bTime.localeCompare(aTime);
  });
}

export function truncatePreview(text: string, max = LAST_MESSAGE_PREVIEW_LENGTH): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
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

  if (filter === 'unread') {
    result = result.filter((c) => (c.unreadCount ?? 0) > 0);
  } else if (filter === 'personal') {
    result = result.filter((c) => c.type === 'personal');
  } else if (filter === 'group') {
    result = result.filter((c) => c.type !== 'personal');
  }

  const q = search.trim().toLowerCase();
  if (!q) return sortConversations(result);

  return sortConversations(
    result.filter((conv) => {
      const title = getConversationDisplayTitle(conv, currentUserId, users).toLowerCase();
      if (title.includes(q)) return true;
      return conv.participantIds.some((id) => {
        const u = users.find((user) => user.id === id);
        if (!u) return false;
        const name = formatUserName(u).toLowerCase();
        return name.includes(q) || u.firstName.toLowerCase().includes(q) || u.lastName.toLowerCase().includes(q);
      });
    }),
  );
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
}

export function groupMessagesForDisplay(
  messages: Message[],
  currentUserId: string,
): MessageGroupItem[] {
  return messages.map((message, index) => {
    const prev = messages[index - 1];
    const sameSender = prev?.senderId === message.senderId && !message.replyToMessageId;
    const sameMinute =
      prev &&
      !message.replyToMessageId &&
      Math.abs(new Date(message.createdAt).getTime() - new Date(prev.createdAt).getTime()) < 5 * 60_000;
    const isOwn = message.senderId === currentUserId;
    const isSystem = message.messageType === 'system';
    return {
      message,
      showSender: !isOwn && !isSystem && (!sameSender || !sameMinute),
      showAvatar: !isOwn && !isSystem && (!sameSender || !sameMinute),
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
