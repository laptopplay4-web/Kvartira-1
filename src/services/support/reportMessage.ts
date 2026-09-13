import type { Conversation, ConversationMember, Message, MessageReportReason, User } from '@/types';
import { canAccessConversation } from '@/services/chat/access';
import { getAttachmentsPreviewLabel } from '@/services/chat/attachments';
import { getConversationDisplayTitle } from '@/services/chat/helpers';
import { getMessageDisplayText, isMessageDeleted, isSystemMessage } from '@/services/chat/messages';

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

/** Human-readable preview of the reported message (text or attachment label). */
export function formatReportedMessagePreview(message: Message): string {
  if (isMessageDeleted(message)) return 'Сообщение удалено';
  const text = getMessageDisplayText(message).trim();
  if (text) return text;
  const attachmentsLabel = getAttachmentsPreviewLabel(message.attachments);
  return attachmentsLabel || 'Вложение';
}

export function resolveReportConversationTitle(input: {
  conversation: Conversation;
  reporterId: string;
  users: User[];
}): string {
  return getConversationDisplayTitle(input.conversation, input.reporterId, input.users);
}

export function buildReportTicketMessage(
  reason: MessageReportReason,
  details: string,
  context: {
    conversationId: string;
    messageId: string;
    conversationTitle?: string;
    messagePreview?: string;
  },
): string {
  const chatLabel = context.conversationTitle?.trim() || context.conversationId;
  const msgLabel = context.messagePreview?.trim() || context.messageId;
  const lines = [
    `Причина: ${MESSAGE_REPORT_REASON_LABELS[reason]}`,
    `Чат: ${chatLabel}`,
    `Сообщение: ${msgLabel}`,
  ];
  const trimmed = details.trim();
  if (trimmed) {
    lines.push('', 'Комментарий:', trimmed);
  }
  return lines.join('\n');
}

/** Deep-link into chat with red report highlight on the target message. */
export function buildReportedMessageChatLink(context: {
  conversationId: string;
  messageId: string;
}): string {
  const msg = encodeURIComponent(context.messageId);
  return `/chat/${context.conversationId}?msg=${msg}&hl=report`;
}

/** User optional comment from built report ticket body. */
export function extractReportComment(ticketMessage: string): string | null {
  const markers = ['\nКомментарий:\n', '\nКомментарий:'];
  for (const marker of markers) {
    const idx = ticketMessage.indexOf(marker);
    if (idx === -1) continue;
    const comment = ticketMessage.slice(idx + marker.length).trim();
    return comment || null;
  }
  return null;
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
