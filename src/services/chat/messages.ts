import { can } from '@/permissions';
import type { Conversation, ConversationMember, Message, MessageReaction, User } from '@/types';
import { MESSAGE_EDIT_WINDOW_MS } from './constants';
import { isGroupConversation } from './access';

export const DELETED_MESSAGE_TEXT = 'Сообщение удалено';

export function isMessageDeleted(message: Message): boolean {
  return !!message.deletedAt;
}

export function isSystemMessage(message: Message): boolean {
  return message.messageType === 'system';
}

export function getMessageDisplayText(message: Message): string {
  if (isMessageDeleted(message)) return DELETED_MESSAGE_TEXT;
  return message.text;
}

export function isWithinEditWindow(message: Message, nowMs = Date.now()): boolean {
  const created = Date.parse(message.createdAt);
  if (Number.isNaN(created)) return false;
  return nowMs - created <= MESSAGE_EDIT_WINDOW_MS;
}

export function canEditMessage(user: User, message: Message, nowMs = Date.now()): boolean {
  if (!can(user, 'chat:send') && !can(user, 'chat:write')) return false;
  if (isMessageDeleted(message)) return false;
  if (isSystemMessage(message)) return false;
  if (message.senderId !== user.id) return false;
  return isWithinEditWindow(message, nowMs);
}

/**
 * Own: always. Admin: any accessible chat.
 * Teacher: only in group / school-wide (not personal).
 */
export function canDeleteMessage(
  user: User,
  message: Message,
  conversation?: Conversation | null,
): boolean {
  if (!can(user, 'chat:delete_message')) return false;
  if (isMessageDeleted(message)) return false;
  if (isSystemMessage(message)) return false;
  if (message.senderId === user.id) return true;
  if (user.role === 'admin') return true;
  if (user.role === 'teacher' && conversation && isGroupConversation(conversation.type)) {
    return true;
  }
  return false;
}

export function canPinMessage(
  user: User,
  members: ConversationMember[],
  conversationId: string,
): boolean {
  // Only school staff (teacher|admin) may pin/unpin messages — not students,
  // even if they are conversation owner/admin.
  if (user.role !== 'teacher' && user.role !== 'admin') return false;
  if (!can(user, 'chat:pin_message')) return false;
  return members.some(
    (m) => m.conversationId === conversationId && m.userId === user.id,
  );
}

export function getReadReceiptLabel(
  message: Message,
  isGroup: boolean,
  readCount?: number,
): string | null {
  if (message.status === 'sending') return null;
  if (message.status === 'failed') return null;
  if (isGroup) {
    if (readCount && readCount > 0) {
      return readCount === 1 ? 'Прочитано' : `Прочитано: ${readCount}`;
    }
    return null;
  }
  if (message.status === 'read') return 'Прочитано';
  return 'Отправлено';
}

export function countReaders(message: Message, senderId: string): number {
  return message.readBy.filter((id) => id !== senderId).length;
}

/** True when every participant except sender has lastReadAt >= message.createdAt. */
export function isMessageReadByAll(
  message: Message,
  members: ConversationMember[],
  participantIds: string[],
): boolean {
  const others = participantIds.filter((id) => id !== message.senderId);
  if (others.length === 0) return true;
  const created = Date.parse(message.createdAt);
  if (Number.isNaN(created)) return false;
  return others.every((userId) => {
    const member = members.find((m) => m.userId === userId);
    if (!member?.lastReadAt) return message.readBy.includes(userId);
    const readAt = Date.parse(member.lastReadAt);
    return !Number.isNaN(readAt) && readAt >= created;
  });
}

export function resolveOwnReceiptStatus(
  message: Message,
  members: ConversationMember[],
  participantIds: string[],
): Message['status'] {
  if (message.status === 'sending' || message.status === 'failed') return message.status;
  if (isMessageReadByAll(message, members, participantIds)) return 'read';
  return 'sent';
}

export function getMessageReactions(message: Message): MessageReaction[] {
  return message.reactions ?? message.metadata?.reactions ?? [];
}

export function toggleReactionList(
  reactions: MessageReaction[],
  emoji: string,
  userId: string,
): MessageReaction[] {
  const next = reactions.map((r) => ({ ...r, userIds: [...r.userIds] }));
  const existing = next.find((r) => r.emoji === emoji);
  if (existing) {
    if (existing.userIds.includes(userId)) {
      existing.userIds = existing.userIds.filter((id) => id !== userId);
    } else {
      // one reaction per user: remove from other emojis
      for (const r of next) {
        r.userIds = r.userIds.filter((id) => id !== userId);
      }
      existing.userIds.push(userId);
    }
  } else {
    for (const r of next) {
      r.userIds = r.userIds.filter((id) => id !== userId);
    }
    next.push({ emoji, userIds: [userId] });
  }
  return next.filter((r) => r.userIds.length > 0);
}
