import { can } from '@/permissions';
import type { ConversationMember, Message, User } from '@/types';

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

export function canEditMessage(user: User, message: Message): boolean {
  if (!can(user, 'chat:send') && !can(user, 'chat:write')) return false;
  if (isMessageDeleted(message)) return false;
  if (isSystemMessage(message)) return false;
  return message.senderId === user.id;
}

export function canDeleteMessage(user: User, message: Message): boolean {
  if (!can(user, 'chat:delete_message')) return false;
  if (isMessageDeleted(message)) return false;
  if (isSystemMessage(message)) return false;
  if (message.senderId === user.id) return true;
  return user.role === 'admin';
}

export function canPinMessage(
  user: User,
  members: ConversationMember[],
  conversationId: string,
): boolean {
  if (!can(user, 'chat:pin_message')) return false;
  const member = members.find((m) => m.conversationId === conversationId && m.userId === user.id);
  if (!member) return false;
  return member.role === 'owner' || member.role === 'admin' || user.role === 'admin' || user.role === 'teacher';
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
