import { describe, it, expect, beforeEach } from 'vitest';
import { mockChatApi, resetMockDatabase } from '@/services/api/mock';
import { ApiError } from '@/services/api/types';
import { filterConversations } from '@/services/chat/helpers';
import { users } from '@/mocks/seed';

describe('chat access', () => {
  beforeEach(() => {
    resetMockDatabase();
  });

  it('user can access own conversation', async () => {
    const conv = await mockChatApi.getConversation('conv-1', 'user-student');
    expect(conv.id).toBe('conv-1');
  });

  it('user cannot access foreign conversation (IDOR)', async () => {
    await expect(mockChatApi.getConversation('conv-3', 'user-student')).rejects.toThrow(ApiError);
    try {
      await mockChatApi.getConversation('conv-3', 'user-student');
    } catch (e) {
      expect((e as ApiError).status).toBe(403);
    }
  });

  it('admin does not access personal chats without membership', async () => {
    await expect(mockChatApi.getConversation('conv-1', 'user-admin')).rejects.toThrow(ApiError);
  });

  it('user can read own conversation messages', async () => {
    const result = await mockChatApi.getMessages('conv-1', 'user-student');
    expect(result.messages.length).toBeGreaterThan(0);
  });

  it('user cannot read foreign messages (IDOR)', async () => {
    await expect(mockChatApi.getMessages('conv-3', 'user-student')).rejects.toThrow(ApiError);
  });
});

describe('send message', () => {
  beforeEach(() => {
    resetMockDatabase();
  });

  it('creates valid message', async () => {
    const msg = await mockChatApi.sendMessage('conv-1', 'user-student', '  Привет  ');
    expect(msg.text).toBe('Привет');
    expect(msg.status).toBe('sent');
  });

  it('rejects empty message', async () => {
    await expect(mockChatApi.sendMessage('conv-1', 'user-student', '   ')).rejects.toThrow(ApiError);
  });

  it('rejects too long message', async () => {
    await expect(mockChatApi.sendMessage('conv-1', 'user-student', 'x'.repeat(4001))).rejects.toThrow(
      ApiError,
    );
  });

  it('deduplicates by clientMutationId', async () => {
    const id = 'dup-test-1';
    const a = await mockChatApi.sendMessage('conv-1', 'user-student', 'Раз', { clientMutationId: id });
    const b = await mockChatApi.sendMessage('conv-1', 'user-student', 'Раз', { clientMutationId: id });
    expect(a.id).toBe(b.id);
  });

  it('updates conversation lastMessage', async () => {
    await mockChatApi.sendMessage('conv-1', 'user-student', 'Новое');
    const conv = await mockChatApi.getConversation('conv-1', 'user-student');
    expect(conv.lastMessage?.text).toBe('Новое');
  });
});

describe('read state', () => {
  beforeEach(() => {
    resetMockDatabase();
  });

  it('marks conversation as read and clears unread', async () => {
    const before = await mockChatApi.getConversation('conv-5', 'user-student');
    expect(before.unreadCount).toBeGreaterThan(0);

    await mockChatApi.markAsRead('conv-5', 'user-student');
    const after = await mockChatApi.getConversation('conv-5', 'user-student');
    expect(after.unreadCount).toBe(0);
  });

  it('does not change other user unread', async () => {
    await mockChatApi.markAsRead('conv-5', 'user-student');
    const teacherView = await mockChatApi.getConversation('conv-5', 'user-teacher-2');
    expect(teacherView.unreadCount).toBe(0);
  });
});

describe('personal chat creation', () => {
  beforeEach(() => {
    resetMockDatabase();
  });

  it('returns existing personal conversation instead of duplicate', async () => {
    const first = await mockChatApi.createConversation('user-student', {
      type: 'personal',
      participantIds: ['user-teacher-1'],
    });
    const second = await mockChatApi.createConversation('user-student', {
      type: 'personal',
      participantIds: ['user-teacher-1'],
    });
    expect(second.id).toBe(first.id);
  });
});

describe('group creation', () => {
  beforeEach(() => {
    resetMockDatabase();
  });

  it('authorized teacher can create group', async () => {
    const conv = await mockChatApi.createConversation('user-teacher-1', {
      type: 'group',
      title: 'Новая группа',
      participantIds: ['user-student', 'user-student-2'],
    });
    expect(conv.title).toBe('Новая группа');
    expect(conv.participantIds).toContain('user-teacher-1');
  });

  it('student cannot create group', async () => {
    await expect(
      mockChatApi.createConversation('user-student', {
        type: 'group',
        title: 'Группа',
        participantIds: ['user-teacher-1'],
      }),
    ).rejects.toThrow(ApiError);
  });

  it('rejects group without title', async () => {
    await expect(
      mockChatApi.createConversation('user-teacher-1', {
        type: 'group',
        title: '',
        participantIds: ['user-student'],
      }),
    ).rejects.toThrow(ApiError);
  });

  it('rejects duplicate members via unique set', async () => {
    const conv = await mockChatApi.createConversation('user-teacher-1', {
      type: 'group',
      title: 'Группа',
      participantIds: ['user-student', 'user-student', 'user-student-2'],
    });
    expect(new Set(conv.participantIds).size).toBe(conv.participantIds.length);
  });
});

describe('search and filters', () => {
  beforeEach(() => {
    resetMockDatabase();
  });

  it('search filters conversations by title', async () => {
    const all = await mockChatApi.getConversations('user-student');
    const filtered = filterConversations(all, {
      search: 'Елена',
      filter: 'all',
      currentUserId: 'user-student',
      users,
    });
    expect(filtered.some((c) => c.id === 'conv-1')).toBe(true);
    expect(filtered.length).toBeGreaterThan(0);
  });

  it('filters unread conversations', async () => {
    const all = await mockChatApi.getConversations('user-student');
    const filtered = filterConversations(all, {
      filter: 'unread',
      currentUserId: 'user-student',
      users,
    });
    expect(filtered.every((c) => (c.unreadCount ?? 0) > 0)).toBe(true);
  });

  it('filters personal conversations', async () => {
    const all = await mockChatApi.getConversations('user-student');
    const filtered = filterConversations(all, {
      filter: 'personal',
      currentUserId: 'user-student',
      users,
    });
    expect(filtered.every((c) => c.type === 'personal')).toBe(true);
  });

  it('filters group conversations', async () => {
    const all = await mockChatApi.getConversations('user-student');
    const filtered = filterConversations(all, {
      filter: 'group',
      currentUserId: 'user-student',
      users,
    });
    expect(filtered.every((c) => c.type !== 'personal')).toBe(true);
  });
});

describe('notifications', () => {
  beforeEach(() => {
    resetMockDatabase();
  });

  it('creates notification for closed chat', async () => {
    const { mockNotificationsApi } = await import('@/services/api/mock');
    const before = (await mockNotificationsApi.getNotifications('user-student')).length;
    await mockChatApi.sendMessage('conv-1', 'user-teacher-1', 'Новое уведомление');
    const after = await mockNotificationsApi.getNotifications('user-student');
    expect(after.length).toBeGreaterThan(before);
    expect(after[0]?.type).toBe('message');
  });

  it('skips notification when chat is open', async () => {
    const { mockNotificationsApi } = await import('@/services/api/mock');
    await mockChatApi.setOpenConversation('user-student', 'conv-1');
    const before = (await mockNotificationsApi.getNotifications('user-student')).length;
    await mockChatApi.sendMessage('conv-1', 'user-teacher-1', 'Открытый чат');
    const after = await mockNotificationsApi.getNotifications('user-student');
    expect(after.length).toBe(before);
  });
});

describe('total unread', () => {
  beforeEach(() => {
    resetMockDatabase();
  });

  it('sums unread across accessible conversations', async () => {
    const total = await mockChatApi.getTotalUnread('user-student');
    const convs = await mockChatApi.getConversations('user-student');
    const expected = convs.reduce((s, c) => s + (c.unreadCount ?? 0), 0);
    expect(total).toBe(expected);
  });
});

describe('message pagination', () => {
  beforeEach(() => {
    resetMockDatabase();
  });

  it('returns paginated messages', async () => {
    for (let i = 0; i < 5; i++) {
      await mockChatApi.sendMessage('conv-1', 'user-student', `msg ${i}`);
    }
    const page1 = await mockChatApi.getMessages('conv-1', 'user-student', { limit: 3 });
    expect(page1.messages).toHaveLength(3);
    expect(page1.hasMore).toBe(true);
    const page2 = await mockChatApi.getMessages('conv-1', 'user-student', {
      limit: 3,
      cursor: page1.nextCursor,
    });
    expect(page2.messages.length).toBeGreaterThan(0);
  });
});

describe('edit message', () => {
  beforeEach(() => resetMockDatabase());

  it('edits own message', async () => {
    const msg = await mockChatApi.sendMessage('conv-1', 'user-student', 'Оригинал');
    const edited = await mockChatApi.editMessage('conv-1', msg.id, 'user-student', { text: 'Изменено' });
    expect(edited.text).toBe('Изменено');
    expect(edited.editedAt).toBeDefined();
  });

  it('rejects editing foreign message (IDOR)', async () => {
    const msg = await mockChatApi.sendMessage('conv-1', 'user-student', 'Текст');
    await expect(
      mockChatApi.editMessage('conv-1', msg.id, 'user-teacher-1', { text: 'Взлом' }),
    ).rejects.toThrow(ApiError);
  });

  it('rejects editing deleted message', async () => {
    const msg = await mockChatApi.sendMessage('conv-1', 'user-student', 'Удалю');
    await mockChatApi.deleteMessage('conv-1', msg.id, 'user-student');
    await expect(
      mockChatApi.editMessage('conv-1', msg.id, 'user-student', { text: 'Нет' }),
    ).rejects.toThrow(ApiError);
  });
});

describe('delete message', () => {
  beforeEach(() => resetMockDatabase());

  it('soft-deletes own message', async () => {
    const msg = await mockChatApi.sendMessage('conv-1', 'user-student', 'Удалить');
    const deleted = await mockChatApi.deleteMessage('conv-1', msg.id, 'user-student');
    expect(deleted.deletedAt).toBeDefined();
  });

  it('rejects deleting foreign message (IDOR)', async () => {
    const msg = await mockChatApi.sendMessage('conv-1', 'user-student', 'Чужое');
    await expect(mockChatApi.deleteMessage('conv-1', msg.id, 'user-teacher-1')).rejects.toThrow(ApiError);
  });
});

describe('reply message', () => {
  beforeEach(() => resetMockDatabase());

  it('sends message with replyToMessageId', async () => {
    const original = await mockChatApi.sendMessage('conv-1', 'user-teacher-1', 'Вопрос?');
    const reply = await mockChatApi.sendMessage('conv-1', 'user-student', 'Ответ', {
      replyToMessageId: original.id,
    });
    expect(reply.replyToMessageId).toBe(original.id);
  });
});

describe('search messages', () => {
  beforeEach(() => resetMockDatabase());

  it('finds messages by text', async () => {
    await mockChatApi.sendMessage('conv-1', 'user-student', 'УникальныйПоискТермин');
    const results = await mockChatApi.searchMessages('user-student', 'УникальныйПоиск');
    expect(results.some((r) => r.message.text.includes('УникальныйПоискТермин'))).toBe(true);
  });

  it('does not return foreign conversation messages (IDOR)', async () => {
    const results = await mockChatApi.searchMessages('user-student', 'домашнее');
    expect(results.every((r) => r.conversationId !== 'conv-3' || r.conversationId === 'conv-3')).toBe(true);
    expect(results.some((r) => r.conversationId === 'conv-3')).toBe(false);
  });
});

describe('group management', () => {
  beforeEach(() => resetMockDatabase());

  it('teacher can add member', async () => {
    const conv = await mockChatApi.createConversation('user-teacher-1', {
      type: 'group',
      title: 'Тест',
      participantIds: ['user-student'],
    });
    await mockChatApi.addMember(conv.id, 'user-teacher-1', 'user-student-2');
    const members = await mockChatApi.getMembers(conv.id, 'user-teacher-1');
    expect(members.some((m) => m.userId === 'user-student-2')).toBe(true);
  });

  it('student cannot add member', async () => {
    await expect(mockChatApi.addMember('conv-2', 'user-student', 'user-admin')).rejects.toThrow(ApiError);
  });

  it('teacher can remove member', async () => {
    await mockChatApi.removeMember('conv-2', 'user-teacher-1', 'user-student-2');
    const members = await mockChatApi.getMembers('conv-2', 'user-teacher-1');
    expect(members.some((m) => m.userId === 'user-student-2')).toBe(false);
  });
});

describe('mute', () => {
  beforeEach(() => resetMockDatabase());

  it('mutes and unmutes conversation', async () => {
    const member = await mockChatApi.muteConversation('conv-1', 'user-student', { muted: true });
    expect(member.muted).toBe(true);
    const unmuted = await mockChatApi.muteConversation('conv-1', 'user-student', { muted: false });
    expect(unmuted.muted).toBe(false);
  });

  it('suppresses notification when muted', async () => {
    const { mockNotificationsApi } = await import('@/services/api/mock');
    await mockChatApi.muteConversation('conv-1', 'user-student', { muted: true });
    const before = (await mockNotificationsApi.getNotifications('user-student')).length;
    await mockChatApi.sendMessage('conv-1', 'user-teacher-1', 'Muted test');
    const after = await mockNotificationsApi.getNotifications('user-student');
    expect(after.length).toBe(before);
  });
});

describe('pin message', () => {
  beforeEach(() => resetMockDatabase());

  it('teacher can pin message in group', async () => {
    const msg = await mockChatApi.sendMessage('conv-2', 'user-teacher-1', 'Важно');
    const conv = await mockChatApi.pinMessage('conv-2', msg.id, 'user-teacher-1');
    expect(conv.pinnedMessageIds).toContain(msg.id);
  });

  it('student cannot pin message', async () => {
    const msg = await mockChatApi.sendMessage('conv-2', 'user-teacher-1', 'Важно');
    await expect(mockChatApi.pinMessage('conv-2', msg.id, 'user-student')).rejects.toThrow(ApiError);
  });
});

describe('attachments', () => {
  beforeEach(() => resetMockDatabase());

  it('uploads valid attachment', async () => {
    const att = await mockChatApi.uploadAttachment('conv-1', 'user-student', {
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
    });
    expect(att.type).toBe('image');
  });

  it('rejects oversized file', async () => {
    await expect(
      mockChatApi.uploadAttachment('conv-1', 'user-student', {
        filename: 'big.jpg',
        mimeType: 'image/jpeg',
        size: 20 * 1024 * 1024,
      }),
    ).rejects.toThrow(ApiError);
  });

  it('rejects unsupported type', async () => {
    await expect(
      mockChatApi.uploadAttachment('conv-1', 'user-student', {
        filename: 'virus.exe',
        mimeType: 'application/x-msdownload',
        size: 100,
      }),
    ).rejects.toThrow(ApiError);
  });
});

describe('realtime', () => {
  beforeEach(() => resetMockDatabase());

  it('emits message.created event', async () => {
    const { chatRealtimeService } = await import('@/services/chat/realtime');
    const events: string[] = [];
    const unsub = chatRealtimeService.subscribe('conv-1', (e) => events.push(e.type));
    await mockChatApi.sendMessage('conv-1', 'user-student', 'Realtime');
    expect(events).toContain('message.created');
    unsub();
  });
});

describe('cache isolation', () => {
  beforeEach(() => resetMockDatabase());

  it('student and teacher see different conversations', async () => {
    const studentConvs = await mockChatApi.getConversations('user-student');
    const teacherConvs = await mockChatApi.getConversations('user-teacher-1');
    const studentIds = new Set(studentConvs.map((c) => c.id));
    expect(teacherConvs.some((c) => c.id === 'conv-3' && !studentIds.has('conv-3'))).toBe(true);
    expect(studentConvs.some((c) => c.id === 'conv-3')).toBe(false);
  });
});
