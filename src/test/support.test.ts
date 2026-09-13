import { describe, it, expect, beforeEach } from 'vitest';
import { can } from '@/permissions';
import { canCreateTicket, canManageFaq, canReplyToTicket, canViewTicket } from '@/services/support/access';
import { filterFaqArticles, filterTickets, parseFaqKeywords, searchTickets, sortTicketsByDate } from '@/services/support/helpers';
import { validateCreateTicketInput, validateFaqArticleInput, validateReplyInput, validateSupportAttachment } from '@/services/support/validation';
import { createMockSupportApi } from '@/services/api/mock/support';
import { helpArticles, initialSupportTickets, users } from '@/mocks/seed';
import type { AppNotification, HelpArticle, SupportTicket, User } from '@/types';
import { ApiError } from '@/services/api/types';

const student = users.find((u) => u.id === 'user-student')!;
const admin = users.find((u) => u.id === 'user-admin')!;
const ownTicket = initialSupportTickets[0];
const otherTicket = initialSupportTickets[1];

const teacher: User = {
  id: 'user-teacher-test',
  phone: '+79001111111',
  role: 'teacher',
  firstName: 'Test',
  lastName: 'Teacher',
};

function createTestDb() {
  return {
    users: [...users],
    helpArticles: structuredClone(helpArticles) as HelpArticle[],
    supportTickets: structuredClone(initialSupportTickets) as SupportTicket[],
    notifications: [] as AppNotification[],
  };
}

describe('support access', () => {
  it('student can view own ticket only', () => {
    expect(canViewTicket(student, ownTicket)).toBe(true);
    expect(canViewTicket(student, otherTicket)).toBe(false);
  });

  it('admin can view all tickets', () => {
    expect(canViewTicket(admin, ownTicket)).toBe(true);
    expect(canViewTicket(admin, otherTicket)).toBe(true);
  });

  it('admin can reply to open tickets', () => {
    expect(canReplyToTicket(admin, otherTicket)).toBe(true);
    expect(canReplyToTicket(admin, { ...otherTicket, status: 'closed' })).toBe(false);
  });

  it('student cannot reply', () => {
    expect(canReplyToTicket(student, otherTicket)).toBe(false);
  });

  it('all roles can create tickets', () => {
    expect(canCreateTicket(student)).toBe(true);
    expect(canCreateTicket(teacher)).toBe(true);
    expect(canCreateTicket(admin)).toBe(true);
  });

  it('only admin can manage FAQ', () => {
    expect(canManageFaq(admin)).toBe(true);
    expect(canManageFaq(student)).toBe(false);
    expect(canManageFaq(teacher)).toBe(false);
  });
});

describe('support helpers', () => {
  it('filters FAQ by query', () => {
    const filtered = filterFaqArticles(helpArticles, 'запись');
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((a) => a.question.toLowerCase().includes('запис') || a.answer.toLowerCase().includes('запис'))).toBe(true);
  });

  it('sorts tickets by updatedAt desc', () => {
    const sorted = sortTicketsByDate(initialSupportTickets);
    expect(new Date(sorted[0].updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(sorted[1].updatedAt).getTime(),
    );
  });

  it('filters tickets by status and category', () => {
    const openAssignments = filterTickets(initialSupportTickets, {
      status: 'open',
      category: 'assignments',
    });
    expect(openAssignments).toHaveLength(1);
    expect(openAssignments[0].id).toBe('ticket-2');
  });

  it('searches tickets by subject and attachment filename', () => {
    const results = searchTickets(initialSupportTickets, 'mp3');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('ticket-2');
  });

  it('parses FAQ keywords', () => {
    expect(parseFaqKeywords('запись, слот ,')).toEqual(['запись', 'слот']);
  });
});

describe('support validation', () => {
  it('rejects short message', () => {
    expect(() =>
      validateCreateTicketInput({ subject: 'Test', message: 'short', category: 'other' }),
    ).toThrow(ApiError);
  });

  it('rejects short reply', () => {
    expect(() => validateReplyInput('tiny')).toThrow(ApiError);
  });

  it('rejects invalid attachment', () => {
    const result = validateSupportAttachment({
      filename: 'bad.exe',
      mimeType: 'application/x-msdownload',
      size: 1000,
    });
    expect(result.valid).toBe(false);
  });

  it('rejects short FAQ question', () => {
    expect(() => validateFaqArticleInput({ question: '???', answer: 'Достаточно длинный ответ FAQ' })).toThrow(
      ApiError,
    );
  });
});

describe('mock support api', () => {
  let db: ReturnType<typeof createTestDb>;
  let api: ReturnType<typeof createMockSupportApi>;

  beforeEach(() => {
    db = createTestDb();
    api = createMockSupportApi(db, async () => {});
  });

  it('returns FAQ articles', async () => {
    const articles = await api.getFaqArticles();
    expect(articles.length).toBe(helpArticles.length);
  });

  it('student lists own tickets only', async () => {
    const tickets = await api.getTickets({ requesterId: student.id });
    expect(tickets.every((t) => t.userId === student.id)).toBe(true);
  });

  it('admin lists all tickets', async () => {
    const tickets = await api.getTickets({ requesterId: admin.id });
    expect(tickets.length).toBe(initialSupportTickets.length);
  });

  it('admin filters tickets by status', async () => {
    const tickets = await api.getTickets({ requesterId: admin.id, status: 'open' });
    expect(tickets.every((t) => t.status === 'open')).toBe(true);
    expect(tickets.some((t) => t.id === 'ticket-2')).toBe(true);
  });

  it('searches tickets via API query', async () => {
    const tickets = await api.getTickets({ requesterId: admin.id, query: 'слоты' });
    expect(tickets.some((t) => t.id === 'ticket-1')).toBe(true);
  });

  it('admin creates FAQ article', async () => {
    const article = await api.createFaqArticle(
      {
        question: 'Как связаться с администрацией?',
        answer: 'Создайте обращение в разделе «Помощь» или напишите в чат школы.',
        category: 'other',
        keywords: ['контакт', 'админ'],
      },
      admin.id,
    );
    expect(db.helpArticles.some((a) => a.id === article.id)).toBe(true);
  });

  it('admin updates FAQ article', async () => {
    const updated = await api.updateFaqArticle(
      helpArticles[0].id,
      { answer: 'Обновлённый ответ с подробной инструкцией по записи на занятия.' },
      admin.id,
    );
    expect(updated.answer).toContain('Обновлённый');
  });

  it('admin deletes FAQ article', async () => {
    const before = db.helpArticles.length;
    await api.deleteFaqArticle(helpArticles[0].id, admin.id);
    expect(db.helpArticles).toHaveLength(before - 1);
  });

  it('student cannot manage FAQ', async () => {
    await expect(
      api.createFaqArticle(
        {
          question: 'Попытка создать FAQ',
          answer: 'Студент не должен иметь доступ к управлению FAQ',
          category: 'other',
        },
        student.id,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('uploads support attachment', async () => {
    const uploaded = await api.uploadSupportAttachment(
      { filename: 'screen.png', mimeType: 'image/png', size: 1024, dataUrl: 'data:image/png;base64,abc' },
      student.id,
    );
    expect(uploaded.filename).toBe('screen.png');
  });

  it('creates ticket with attachments', async () => {
    const ticket = await api.createTicket(
      {
        subject: 'Скриншот ошибки',
        message: 'Прикладываю скриншот проблемы в приложении',
        category: 'technical',
        attachments: [{ filename: 'screen.png', mimeType: 'image/png', url: 'mock://support/screen.png' }],
      },
      student.id,
    );
    expect(ticket.attachments).toHaveLength(1);
  });

  it('blocks IDOR on getTicket', async () => {
    await expect(api.getTicket(otherTicket.id, student.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('admin reply notifies user', async () => {
    const updated = await api.replyToTicket(
      otherTicket.id,
      { text: 'Мы проверили загрузку файлов, попробуйте снова.' },
      admin.id,
    );
    expect(updated.status).toBe('answered');
    expect(updated.adminReply?.text).toContain('проверили');
    expect(db.notifications.some((n) => n.userId === otherTicket.userId)).toBe(true);
  });

  it('student cannot reply', async () => {
    await expect(
      api.replyToTicket(otherTicket.id, { text: 'Попытка ответа от ученика здесь' }, student.id),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('creates message report ticket with reportContext and notifies admins', async () => {
    const ticket = await api.createTicket(
      {
        subject: 'Жалоба на сообщение: Спам',
        message: 'Причина: Спам\nЧат: conv-1\nСообщение: msg-report-1',
        category: 'chat',
        reportContext: {
          conversationId: 'conv-1',
          messageId: 'msg-report-1',
          reason: 'spam',
        },
      },
      student.id,
    );
    expect(ticket.reportContext?.messageId).toBe('msg-report-1');
    expect(ticket.reportContext?.reason).toBe('spam');
    expect(db.notifications.some((n) => n.userId === admin.id && n.link?.includes(ticket.id))).toBe(
      true,
    );
  });

  it('rejects duplicate open report for the same message', async () => {
    await api.createTicket(
      {
        subject: 'Жалоба на сообщение: Спам',
        message: 'Причина: Спам\nЧат: conv-1\nСообщение: msg-dup',
        category: 'chat',
        reportContext: {
          conversationId: 'conv-1',
          messageId: 'msg-dup',
          reason: 'spam',
        },
      },
      student.id,
    );
    await expect(
      api.createTicket(
        {
          subject: 'Жалоба на сообщение: Спам',
          message: 'Причина: Спам\nЧат: conv-1\nСообщение: msg-dup',
          category: 'chat',
          reportContext: {
            conversationId: 'conv-1',
            messageId: 'msg-dup',
            reason: 'spam',
          },
        },
        student.id,
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('support permissions', () => {
  it('student has support permissions', () => {
    expect(can(student, 'support:view-faq')).toBe(true);
    expect(can(student, 'support:create-ticket')).toBe(true);
    expect(can(student, 'support:reply-ticket')).toBe(false);
  });

  it('admin has reply permission', () => {
    expect(can(admin, 'support:reply-ticket')).toBe(true);
    expect(can(admin, 'support:view-all-tickets')).toBe(true);
    expect(can(admin, 'support:manage-faq')).toBe(true);
  });
});
