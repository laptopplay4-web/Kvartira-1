import { ClientResponseError } from 'pocketbase';
import type {
  CreateHelpArticleInput,
  CreateSupportTicketInput,
  ReplySupportTicketInput,
  SupportApi,
  UpdateHelpArticleInput,
  UploadSupportAttachmentInput,
} from '@/services/api/types';
import { ApiError } from '@/services/api/types';
import { getPocketBase } from '@/services/api/pocketbase/client';
import { mapPocketBaseError, withPbError } from '@/services/api/pocketbase/errors';
import {
  mapHelpArticleRecord,
  mapSupportTicketRecord,
  mapUserRecord,
} from '@/services/api/pocketbase/mappers';
import { escapePbFilter } from '@/services/api/pocketbase/helpers';
import {
  collectStoredFileIds,
  linkStoredFilesToContext,
  resolveSupportTicket,
  uploadStoredFile,
} from '@/services/api/pocketbase/files';
import {
  canCreateTicket,
  canManageFaq,
  canReplyToTicket,
  canViewTicket,
} from '@/services/support/access';
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
import type { SupportTicket, SupportTicketCategory, SupportTicketStatus, User } from '@/types';

function uid(prefix: string): string {
  const suffix = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return `${prefix}-${suffix}`;
}

async function getRequesterUser(userId: string): Promise<User> {
  const pb = getPocketBase();
  try {
    const record = await pb.collection('users').getOne(userId);
    return mapUserRecord(record);
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      throw new ApiError('Пользователь не найден', 'NOT_FOUND', 404);
    }
    throw error;
  }
}

async function loadTicketOrThrow(id: string): Promise<SupportTicket> {
  const pb = getPocketBase();
  try {
    const record = await pb.collection('support_tickets').getOne(id);
    return resolveSupportTicket(mapSupportTicketRecord(record));
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      throw new ApiError('Обращение не найдено', 'NOT_FOUND', 404);
    }
    throw error;
  }
}

async function assertViewAccess(id: string, requesterId: string): Promise<{ user: User; ticket: SupportTicket }> {
  const user = await getRequesterUser(requesterId);
  const ticket = await loadTicketOrThrow(id);
  if (!canViewTicket(user, ticket)) {
    throw new ApiError('Нет доступа к обращению', 'FORBIDDEN', 403);
  }
  return { user, ticket };
}

function buildTicketsFilter(filters: {
  status?: SupportTicketStatus;
  category?: SupportTicketCategory;
}): string {
  const parts: string[] = [];
  if (filters.status) parts.push(`status = "${escapePbFilter(filters.status)}"`);
  if (filters.category) parts.push(`category = "${escapePbFilter(filters.category)}"`);
  return parts.join(' && ');
}

async function pushSupportNotification(userId: string, title: string, body: string, link: string): Promise<void> {
  const pb = getPocketBase();
  try {
    await pb.collection('notifications').create({
      user: userId,
      type: 'system',
      title,
      body,
      read: false,
      link,
    });
  } catch (error) {
    const mapped = mapPocketBaseError(error);
    if (mapped.code !== 'FORBIDDEN') throw error;
  }
}

export const pocketbaseSupportApi: SupportApi = {
  async getFaqArticles(query) {
    return withPbError(async () => {
      const pb = getPocketBase();
      const records = await pb.collection('help_articles').getFullList({ sort: 'question' });
      return filterFaqArticles(records.map(mapHelpArticleRecord), query ?? '');
    });
  },

  async getTickets(filters) {
    return withPbError(async () => {
      const user = await getRequesterUser(filters.requesterId);
      const pb = getPocketBase();
      const filter = buildTicketsFilter(filters);
      const records = await pb.collection('support_tickets').getFullList({
        filter: filter || undefined,
        sort: '-id',
      });
      let list = records
        .map(mapSupportTicketRecord)
        .filter((ticket) => canViewTicket(user, ticket));
      list = filterTickets(list, { status: filters.status, category: filters.category });
      list = searchTickets(list, filters.query ?? '');
      const resolved = await Promise.all(list.map(resolveSupportTicket));
      return sortTicketsByDate(resolved);
    });
  },

  async getTicket(id, requesterId) {
    return withPbError(async () => {
      const { ticket } = await assertViewAccess(id, requesterId);
      return ticket;
    });
  },

  async uploadSupportAttachment(input: UploadSupportAttachmentInput, userId) {
    return withPbError(async () => {
      const user = await getRequesterUser(userId);
      if (!canCreateTicket(user)) {
        throw new ApiError('Нет прав на загрузку вложений', 'FORBIDDEN', 403);
      }
      const result = validateSupportAttachment(input);
      if (!result.valid) throw new ApiError(result.message, 'VALIDATION_ERROR', 400);

      if (!input.dataUrl) {
        throw new ApiError('Файл не передан', 'VALIDATION_ERROR', 400);
      }

      const stored = await uploadStoredFile({
        userId,
        purpose: 'support',
        filename: input.filename,
        mimeType: input.mimeType,
        size: input.size,
        dataUrl: input.dataUrl,
      });

      return {
        filename: stored.filename,
        mimeType: stored.mimeType,
        url: stored.url,
      };
    });
  },

  async createTicket(input: CreateSupportTicketInput, userId) {
    return withPbError(async () => {
      const user = await getRequesterUser(userId);
      if (!canCreateTicket(user)) {
        throw new ApiError('Нельзя создать обращение', 'FORBIDDEN', 403);
      }
      validateCreateTicketInput(input);

      const pb = getPocketBase();
      const attachments =
        input.attachments?.map((attachment) => ({
          ...attachment,
          id: uid('attach'),
        })) ?? [];

      const record = await pb.collection('support_tickets').create({
        user: userId,
        subject: input.subject.trim(),
        message: input.message.trim(),
        category: input.category,
        status: 'open',
        attachments,
        adminReply: null,
        reportContext: input.reportContext ?? null,
      });

      await linkStoredFilesToContext(
        collectStoredFileIds(...attachments.map((attachment) => attachment.url)),
        record.id,
      );

      const ticket = await resolveSupportTicket(mapSupportTicketRecord(record));

      if (input.reportContext) {
        const admins = await pb.collection('users').getFullList({
          filter: 'role = "admin"',
        });
        for (const admin of admins) {
          await pushSupportNotification(
            admin.id,
            'Жалоба на сообщение в чате',
            ticket.subject,
            `/profile/help/${ticket.id}`,
          );
        }
      }

      return ticket;
    });
  },

  async replyToTicket(id, input: ReplySupportTicketInput, adminId) {
    return withPbError(async () => {
      const admin = await getRequesterUser(adminId);
      const ticket = await loadTicketOrThrow(id);
      if (!canReplyToTicket(admin, ticket)) {
        throw new ApiError('Нельзя ответить на обращение', 'FORBIDDEN', 403);
      }
      validateReplyInput(input.text);

      const now = new Date().toISOString();
      const pb = getPocketBase();
      const record = await pb.collection('support_tickets').update(id, {
        adminReply: {
          text: input.text.trim(),
          authorId: adminId,
          createdAt: now,
        },
        status: input.close ? 'closed' : 'answered',
      });

      const updated = await resolveSupportTicket(mapSupportTicketRecord(record));
      await pushSupportNotification(
        updated.userId,
        'Ответ на обращение',
        `Администрация ответила: «${updated.subject}»`,
        `/profile/help/${updated.id}`,
      );

      return updated;
    });
  },

  async createFaqArticle(input: CreateHelpArticleInput, adminId) {
    return withPbError(async () => {
      const admin = await getRequesterUser(adminId);
      if (!canManageFaq(admin)) {
        throw new ApiError('Нет прав на управление FAQ', 'FORBIDDEN', 403);
      }
      validateFaqArticleInput(input);

      const pb = getPocketBase();
      const record = await pb.collection('help_articles').create({
        question: input.question.trim(),
        answer: input.answer.trim(),
        category: input.category,
        keywords: input.keywords?.map((keyword) => keyword.trim()).filter(Boolean) ?? [],
      });

      return mapHelpArticleRecord(record);
    });
  },

  async updateFaqArticle(id, input: UpdateHelpArticleInput, adminId) {
    return withPbError(async () => {
      const admin = await getRequesterUser(adminId);
      if (!canManageFaq(admin)) {
        throw new ApiError('Нет прав на управление FAQ', 'FORBIDDEN', 403);
      }

      const pb = getPocketBase();
      let existing;
      try {
        existing = mapHelpArticleRecord(await pb.collection('help_articles').getOne(id));
      } catch (error) {
        if (error instanceof ClientResponseError && error.status === 404) {
          throw new ApiError('Статья не найдена', 'NOT_FOUND', 404);
        }
        throw error;
      }

      const nextQuestion = input.question?.trim() ?? existing.question;
      const nextAnswer = input.answer?.trim() ?? existing.answer;
      validateFaqArticleInput({ question: nextQuestion, answer: nextAnswer });

      const body: Record<string, unknown> = {};
      if (input.question !== undefined) body.question = nextQuestion;
      if (input.answer !== undefined) body.answer = nextAnswer;
      if (input.category !== undefined) body.category = input.category;
      if (input.keywords !== undefined) {
        body.keywords = input.keywords.map((keyword) => keyword.trim()).filter(Boolean);
      }

      const record = await pb.collection('help_articles').update(id, body);
      return mapHelpArticleRecord(record);
    });
  },

  async deleteFaqArticle(id, adminId) {
    return withPbError(async () => {
      const admin = await getRequesterUser(adminId);
      if (!canManageFaq(admin)) {
        throw new ApiError('Нет прав на управление FAQ', 'FORBIDDEN', 403);
      }

      const pb = getPocketBase();
      try {
        await pb.collection('help_articles').delete(id);
      } catch (error) {
        if (error instanceof ClientResponseError && error.status === 404) {
          throw new ApiError('Статья не найдена', 'NOT_FOUND', 404);
        }
        throw error;
      }
    });
  },
};
