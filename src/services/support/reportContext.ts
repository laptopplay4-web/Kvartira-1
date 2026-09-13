import type {
  Conversation,
  Message,
  SupportTicket,
  SupportTicketReportContext,
  User,
} from '@/types';
import { formatUserName } from '@/utils';
import { getConversationDisplayTitle, isGroupLike } from '@/services/chat/helpers';
import { formatReportedMessagePreview, MESSAGE_REPORT_REASON_LABELS } from '@/services/support/reportMessage';

/** PocketBase-style ids / legacy mock ids — not human chat titles. */
export function looksLikeOpaqueId(value: string | undefined | null): boolean {
  if (!value) return true;
  const v = value.trim();
  if (!v) return true;
  // PB record ids (15 chars alnum) or mock `conv-*` / `msg-*` without spaces
  if (/^[a-z0-9]{10,20}$/i.test(v)) return true;
  if (/^(conv|msg|user)-[\w-]+$/i.test(v)) return true;
  return false;
}

export function reportContextNeedsEnrichment(
  ctx: SupportTicketReportContext | undefined | null,
): boolean {
  if (!ctx) return false;
  const titleOk = !!ctx.conversationTitle?.trim() && !looksLikeOpaqueId(ctx.conversationTitle);
  const previewOk = !!ctx.messagePreview?.trim() && !looksLikeOpaqueId(ctx.messagePreview);
  return !titleOk || !previewOk;
}

/** Title for report UI — works even when viewer is not a chat member. */
export function resolveReportConversationTitle(
  conversation: Conversation,
  users: User[],
  viewerId?: string,
): string {
  if (isGroupLike(conversation)) {
    return conversation.title?.trim() || 'Групповой чат';
  }
  if (viewerId && conversation.participantIds.includes(viewerId)) {
    return getConversationDisplayTitle(conversation, viewerId, users);
  }
  const names = conversation.participantIds
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is User => !!u)
    .map((u) => formatUserName(u));
  if (names.length > 0) return names.join(' · ');
  return conversation.title?.trim() || 'Личный чат';
}

export function enrichReportContextFromSources(
  ctx: SupportTicketReportContext,
  sources: {
    conversation?: Conversation | null;
    message?: Message | null;
    users?: User[];
    /** Who is viewing — used for personal chat counterpart name when member. */
    viewerId?: string;
  },
): SupportTicketReportContext {
  const next: SupportTicketReportContext = { ...ctx };
  const users = sources.users ?? [];

  if (
    sources.conversation &&
    (!next.conversationTitle?.trim() || looksLikeOpaqueId(next.conversationTitle))
  ) {
    next.conversationTitle = resolveReportConversationTitle(
      sources.conversation,
      users,
      sources.viewerId,
    );
  }

  if (sources.message && (!next.messagePreview?.trim() || looksLikeOpaqueId(next.messagePreview))) {
    next.messagePreview = formatReportedMessagePreview(sources.message);
  }

  return next;
}

/** Rebuild ticket body so list/detail never show raw ids. */
export function rebuildReportTicketMessage(
  ctx: SupportTicketReportContext,
  existingMessage: string,
): string {
  const chatLabel = ctx.conversationTitle?.trim() || ctx.conversationId;
  const msgLabel = ctx.messagePreview?.trim() || ctx.messageId;
  const lines = [
    `Причина: ${MESSAGE_REPORT_REASON_LABELS[ctx.reason]}`,
    `Чат: ${chatLabel}`,
    `Сообщение: ${msgLabel}`,
  ];
  const commentMatch = existingMessage.match(/\nКомментарий:\n?([\s\S]*)$/);
  const comment = commentMatch?.[1]?.trim();
  if (comment) {
    lines.push('', 'Комментарий:', comment);
  }
  return lines.join('\n');
}

export function applyEnrichedReportContext(
  ticket: SupportTicket,
  enriched: SupportTicketReportContext,
): SupportTicket {
  if (!ticket.reportContext) return ticket;
  return {
    ...ticket,
    reportContext: enriched,
    message: rebuildReportTicketMessage(enriched, ticket.message),
  };
}

export function resolveReportDisplayLabels(ticket: SupportTicket): {
  conversationTitle: string;
  messagePreview: string;
} {
  const ctx = ticket.reportContext;
  if (!ctx) {
    return { conversationTitle: 'Чат', messagePreview: 'Сообщение' };
  }
  const title = ctx.conversationTitle?.trim();
  const preview = ctx.messagePreview?.trim();
  return {
    conversationTitle: title && !looksLikeOpaqueId(title) ? title : 'Чат',
    messagePreview: preview && !looksLikeOpaqueId(preview) ? preview : 'Текст сообщения недоступен',
  };
}

export function formatReportTicketListPreview(ticket: SupportTicket): string {
  if (!ticket.reportContext) return ticket.message;
  const { conversationTitle, messagePreview } = resolveReportDisplayLabels(ticket);
  return `«${conversationTitle}» · ${messagePreview}`;
}
