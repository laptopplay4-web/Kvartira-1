import type { Conversation, ConversationMember, Message, MessageReportReason, User } from '@/types';
import { canAccessConversation } from '@/services/chat/access';
import { isMessageDeleted, isSystemMessage } from '@/services/chat/messages';

export const MESSAGE_REPORT_REASON_LABELS: Record<MessageReportReason, string> = {
  image_rights: 'Изображение без согласия',
  harassment: 'Оскорбления / угрозы',
  spam: 'Спам',
  other: 'Другое',
};

export function canReportMessage(
  user: User,
  message: Message,
  conversation: Conversation | null | undefined,
  members: ConversationMember[],
): boolean {
  if (!conversation) return false;
  if (isMessageDeleted(message)) return false;
  if (isSystemMessage(message)) return false;
  if (message.senderId === user.id) return false;
  return canAccessConversation(user, conversation, members);
}

export function buildReportTicketSubject(reason: MessageReportReason): string {
  return `Жалоба на сообщение: ${MESSAGE_REPORT_REASON_LABELS[reason]}`;
}

export function buildReportTicketMessage(
  reason: MessageReportReason,
  details: string,
  context: { conversationId: string; messageId: string },
): string {
  const lines = [
    `Причина: ${MESSAGE_REPORT_REASON_LABELS[reason]}`,
    `Чат: ${context.conversationId}`,
    `Сообщение: ${context.messageId}`,
  ];
  const trimmed = details.trim();
  if (trimmed) {
    lines.push('', 'Комментарий:', trimmed);
  }
  return lines.join('\n');
}

export function validateReportMessageInput(input: {
  reason: MessageReportReason;
  details?: string;
  conversationId: string;
  messageId: string;
}): void {
  if (!input.conversationId.trim() || !input.messageId.trim()) {
    throw new Error('Не указан контекст сообщения');
  }
  if (!MESSAGE_REPORT_REASON_LABELS[input.reason]) {
    throw new Error('Некорректная причина жалобы');
  }
  if ((input.details ?? '').trim().length > 2000) {
    throw new Error('Слишком длинный комментарий');
  }
}
