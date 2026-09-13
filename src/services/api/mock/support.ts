import type { AppNotification, Conversation, HelpArticle, Message, SupportTicket, User } from '@/types';
import { canCreateTicket, canManageFaq, canReplyToTicket, canViewTicket } from '@/services/support/access';
import {
  adminHelpTicketPath,
  supportTicketAdminNotifyTitle,
} from '@/services/support/adminInbox';
import {
  applyEnrichedReportContext,
  enrichReportContextFromSources,
  reportContextNeedsEnrichment,
} from '@/services/support/reportContext';
import {
  filterFaqArticles,
  filterTickets,
  searchTickets,
  sortTicketsByDate,
} from '@/services/support/helpers';
import {
  validateCreateTicketInput,
  validateFaqArticleInput,
  validateReplyInput,
  validateSupportAttachment,
} from '@/services/support/validation';
import { ApiError } from '@/services/api/types';
import type {
  CreateHelpArticleInput,
  CreateSupportTicketInput,
  ReplySupportTicketInput,
  SupportApi,
  UpdateHelpArticleInput,
  UploadSupportAttachmentInput,
} from '@/services/api/types';

export interface MockSupportDb {
  users: User[];
  helpArticles: HelpArticle[];
  supportTickets: SupportTicket[];
  notifications: AppNotification[];
  conversations?: Conversation[];
  messages?: Message[];
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createMockSupportApi(
  db: MockSupportDb,
  delay: (ms?: number) => Promise<void>,
): SupportApi {
  function getUserById(userId: string): User {
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new ApiError('Пользователь не найден', 'NOT_FOUND', 404);
    return user;
  }

  function getTicketById(id: string): SupportTicket {
    const ticket = db.supportTickets.find((t) => t.id === id);
    if (!ticket) throw new ApiError('Обращение не найдено', 'NOT_FOUND', 404);
    return ticket;
  }

  function getFaqArticleById(id: string): HelpArticle {
    const article = db.helpArticles.find((a) => a.id === id);
    if (!article) throw new ApiError('Статья не найдена', 'NOT_FOUND', 404);
    return article;
  }

  function assertViewAccess(ticket: SupportTicket, requesterId: string): User {
    const user = getUserById(requesterId);
    if (!canViewTicket(user, ticket)) {
      throw new ApiError('Нет доступа к обращению', 'FORBIDDEN', 403);
    }
    return user;
  }

  function assertManageFaq(adminId: string): User {
    const admin = getUserById(adminId);
    if (!canManageFaq(admin)) {
      throw new ApiError('Нет прав на управление FAQ', 'FORBIDDEN', 403);
    }
    return admin;
  }

  function pushSupportNotification(
    userId: string,
    title: string,
    body: string,
    link: string,
    options?: { urgent?: boolean },
  ) {
    db.notifications.push({
      id: uid('notif'),
      userId,
      type: 'system',
      title,
      body,
      read: false,
      createdAt: new Date().toISOString(),
      link,
      ...(options?.urgent ? { urgent: true } : {}),
    });
  }

  function notifyAdminsNewTicket(ticket: SupportTicket) {
    const isReport = Boolean(ticket.reportContext);
    const title = supportTicketAdminNotifyTitle(isReport);
    const link = adminHelpTicketPath(ticket.id);
    for (const admin of db.users.filter((u) => u.role === 'admin')) {
      pushSupportNotification(admin.id, title, ticket.subject, link, { urgent: true });
    }
  }

  /** Resolve chat title + message text without membership (admin report inbox). */
  function enrichTicketReport(ticket: SupportTicket, viewerId: string): SupportTicket {
    if (!ticket.reportContext || !reportContextNeedsEnrichment(ticket.reportContext)) {
      return ticket;
    }
    const conversation = db.conversations?.find((c) => c.id === ticket.reportContext!.conversationId);
    const message = db.messages?.find(
      (m) =>
        m.id === ticket.reportContext!.messageId &&
        m.conversationId === ticket.reportContext!.conversationId,
    );
    const enriched = enrichReportContextFromSources(ticket.reportContext, {
      conversation,
      message,
      users: db.users,
      viewerId,
    });
    const next = applyEnrichedReportContext(ticket, enriched);
    // Persist so subsequent reads / list stay human-readable
    const idx = db.supportTickets.findIndex((t) => t.id === ticket.id);
    if (idx >= 0) {
      db.supportTickets[idx] = next;
    }
    return next;
  }

  return {
    async getFaqArticles(query) {
      await delay();
      return filterFaqArticles(db.helpArticles, query ?? '');
    },

    async getTickets(filters) {
      await delay();
      const user = getUserById(filters.requesterId);
      let list = db.supportTickets.filter((ticket) => canViewTicket(user, ticket));
      list = filterTickets(list, { status: filters.status, category: filters.category });
      list = searchTickets(list, filters.query ?? '');
      return sortTicketsByDate(list).map((ticket) => enrichTicketReport(ticket, filters.requesterId));
    },

    async getTicket(id, requesterId) {
      await delay();
      const ticket = getTicketById(id);
      assertViewAccess(ticket, requesterId);
      return enrichTicketReport(ticket, requesterId);
    },

    async uploadSupportAttachment(input: UploadSupportAttachmentInput, userId) {
      await delay(100);
      const user = getUserById(userId);
      if (!canCreateTicket(user)) {
        throw new ApiError('Нет прав на загрузку вложений', 'FORBIDDEN', 403);
      }
      const result = validateSupportAttachment(input);
      if (!result.valid) throw new ApiError(result.message, 'VALIDATION_ERROR', 400);

      return {
        filename: input.filename,
        mimeType: input.mimeType,
        url: input.dataUrl ?? `mock://support/${uid('file')}`,
      };
    },

    async createTicket(input: CreateSupportTicketInput, userId) {
      await delay();
      const user = getUserById(userId);
      if (!canCreateTicket(user)) {
        throw new ApiError('Нельзя создать обращение', 'FORBIDDEN', 403);
      }
      validateCreateTicketInput(input);

      const now = new Date().toISOString();
      let ticket: SupportTicket = {
        id: uid('ticket'),
        userId,
        subject: input.subject.trim(),
        message: input.message.trim(),
        category: input.category,
        status: 'open',
        createdAt: now,
        updatedAt: now,
        attachments:
          input.attachments?.map((attachment) => ({
            ...attachment,
            id: uid('attach'),
          })) ?? [],
      };
      if (input.reportContext) {
        ticket.reportContext = input.reportContext;
        const duplicate = db.supportTickets.find(
          (t) =>
            t.userId === userId &&
            t.reportContext?.messageId === input.reportContext?.messageId &&
            t.status !== 'closed',
        );
        if (duplicate) {
          throw new ApiError('Жалоба на это сообщение уже отправлена', 'CONFLICT', 409);
        }
        ticket = enrichTicketReport(ticket, userId);
      }
      db.supportTickets.push(ticket);
      notifyAdminsNewTicket(ticket);
      return ticket;
    },

    async replyToTicket(id, input: ReplySupportTicketInput, adminId) {
      await delay();
      const admin = getUserById(adminId);
      const ticket = getTicketById(id);
      if (!canReplyToTicket(admin, ticket)) {
        throw new ApiError('Нельзя ответить на обращение', 'FORBIDDEN', 403);
      }
      validateReplyInput(input.text);

      const now = new Date().toISOString();
      ticket.adminReply = {
        text: input.text.trim(),
        authorId: adminId,
        createdAt: now,
      };
      ticket.status = input.close ? 'closed' : 'answered';
      ticket.updatedAt = now;

      pushSupportNotification(
        ticket.userId,
        'Ответ на обращение',
        `Администрация ответила: «${ticket.subject}»`,
        `/profile/help/${ticket.id}`,
      );

      return ticket;
    },

    async createFaqArticle(input: CreateHelpArticleInput, adminId) {
      await delay();
      assertManageFaq(adminId);
      validateFaqArticleInput(input);

      const article: HelpArticle = {
        id: uid('faq'),
        question: input.question.trim(),
        answer: input.answer.trim(),
        category: input.category,
        keywords: input.keywords?.map((keyword) => keyword.trim()).filter(Boolean) ?? [],
      };
      db.helpArticles.push(article);
      return article;
    },

    async updateFaqArticle(id, input: UpdateHelpArticleInput, adminId) {
      await delay();
      assertManageFaq(adminId);
      const article = getFaqArticleById(id);

      const nextQuestion = input.question?.trim() ?? article.question;
      const nextAnswer = input.answer?.trim() ?? article.answer;
      validateFaqArticleInput({ question: nextQuestion, answer: nextAnswer });

      if (input.question !== undefined) article.question = nextQuestion;
      if (input.answer !== undefined) article.answer = nextAnswer;
      if (input.category !== undefined) article.category = input.category;
      if (input.keywords !== undefined) {
        article.keywords = input.keywords.map((keyword) => keyword.trim()).filter(Boolean);
      }

      return article;
    },

    async deleteFaqArticle(id, adminId) {
      await delay();
      assertManageFaq(adminId);
      const index = db.helpArticles.findIndex((article) => article.id === id);
      if (index === -1) throw new ApiError('Статья не найдена', 'NOT_FOUND', 404);
      db.helpArticles.splice(index, 1);
    },
  };
}
