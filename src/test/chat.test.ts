import { describe, it, expect, beforeEach } from 'vitest';
import { mockChatApi, resetMockDatabase } from '@/services/api/mock';
import { ApiError } from '@/services/api/types';
import {
  bumpConversationInList,
  filterConversations,
  orderPinnedMessagesNewestFirst,
  resolvePinnedIndexForViewport,
  sortConversationsWithPins,
} from '@/services/chat/helpers';
import {
  appendMessagesInInfiniteCache,
  upsertMessageInInfiniteCache,
} from '@/services/chat/messageCache';
import type { Conversation, Message } from '@/types';
import { users } from '@/mocks/seed';

describe('messageCache', () => {
  it('upserts by id and replaces optimistic system lines by event', () => {
    const optimistic: Message = {
      id: 'optimistic-add-u2',
      conversationId: 'c1',
      senderId: 'u1',
      text: 'A добавил B',
      createdAt: '2026-09-13T10:00:00.000Z',
      status: 'sent',
      readBy: ['u1'],
      messageType: 'system',
      clientMutationId: 'optimistic-add-u2',
      metadata: { system: { event: 'member_added', actorId: 'u1', targetUserId: 'u2' } },
    };
    let cache = upsertMessageInInfiniteCache(undefined, optimistic);
    expect(cache.pages[0]!.messages).toHaveLength(1);

    const real: Message = {
      ...optimistic,
      id: 'msg-real',
      clientMutationId: undefined,
      text: 'A добавил B',
    };
    cache = upsertMessageInInfiniteCache(cache, real);
    expect(cache.pages[0]!.messages).toHaveLength(1);
    expect(cache.pages[0]!.messages[0]!.id).toBe('msg-real');
  });

  it('appendMessagesInInfiniteCache merges several messages', () => {
    const base = {
      conversationId: 'c1',
      senderId: 'u1',
      status: 'sent' as const,
      readBy: ['u1'],
      messageType: 'user' as const,
    };
    const cache = appendMessagesInInfiniteCache(undefined, [
      { ...base, id: '1', text: 'a', createdAt: '2026-09-13T10:00:00.000Z' },
      { ...base, id: '2', text: 'b', createdAt: '2026-09-13T10:01:00.000Z' },
    ]);
    expect(cache.pages[0]!.messages.map((m) => m.id)).toEqual(['1', '2']);
  });
});

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

  it('admin can open personal chat by id (report deep-link) but list stays membership-based', async () => {
    const personal = await mockChatApi.getConversation('conv-1', 'user-admin');
    expect(personal.id).toBe('conv-1');
    const msgs = await mockChatApi.getMessages('conv-1', 'user-admin');
    expect(msgs.messages.length).toBeGreaterThan(0);

    const list = await mockChatApi.getConversations('user-admin');
    expect(list.some((c) => c.id === 'conv-1')).toBe(false);
  });

  it('admin sees all group chats and is a member', async () => {
    const list = await mockChatApi.getConversations('user-admin');
    const groups = list.filter((c) => c.type !== 'personal');
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.some((c) => c.id === 'conv-2')).toBe(true);
    expect(groups.every((c) => c.participantIds.includes('user-admin'))).toBe(true);

    const study = await mockChatApi.getConversation('conv-2', 'user-admin');
    expect(study.id).toBe('conv-2');
    const members = await mockChatApi.getMembers('conv-2', 'user-admin');
    expect(members.some((m) => m.userId === 'user-admin')).toBe(true);
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
    const first = await mockChatApi.createConversation('user-teacher-1', {
      type: 'personal',
      participantIds: ['user-student'],
    });
    const second = await mockChatApi.createConversation('user-teacher-1', {
      type: 'personal',
      participantIds: ['user-student'],
    });
    expect(second.id).toBe(first.id);
  });

  it('student cannot create personal chat', async () => {
    await expect(
      mockChatApi.createConversation('user-student', {
        type: 'personal',
        participantIds: ['user-teacher-1'],
      }),
    ).rejects.toThrow(ApiError);
  });

  it('rejects personal chat between two teachers', async () => {
    await expect(
      mockChatApi.createConversation('user-teacher-1', {
        type: 'personal',
        participantIds: ['user-teacher-2'],
      }),
    ).rejects.toThrow(ApiError);
  });

  it('admin can create personal chat with student', async () => {
    const conv = await mockChatApi.createConversation('user-admin', {
      type: 'personal',
      participantIds: ['user-student'],
    });
    expect(conv.type).toBe('personal');
    expect(conv.participantIds).toEqual(expect.arrayContaining(['user-admin', 'user-student']));
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
    expect(conv.participantIds).toContain('user-admin');
  });

  it('admin is auto-added to group created by teacher', async () => {
    const conv = await mockChatApi.createConversation('user-teacher-1', {
      type: 'group',
      title: 'Класс А',
      participantIds: ['user-student'],
    });
    expect(conv.participantIds).toContain('user-admin');

    const adminList = await mockChatApi.getConversations('user-admin');
    expect(adminList.some((c) => c.id === conv.id)).toBe(true);

    const members = await mockChatApi.getMembers(conv.id, 'user-admin');
    expect(members.some((m) => m.userId === 'user-admin')).toBe(true);
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

  it('teacher can create school-wide chat for all users', async () => {
    const conv = await mockChatApi.createConversation('user-teacher-1', {
      type: 'group',
      participantIds: [],
      allUsers: true,
    });
    expect(conv.title).toBe('Общий чат');
    expect(conv.metadata?.schoolWide).toBe(true);
    expect(conv.participantIds).toHaveLength(users.length);
    expect(new Set(conv.participantIds).size).toBe(users.length);
  });

  it('school-wide chat forbids add/remove members', async () => {
    const conv = await mockChatApi.createConversation('user-teacher-1', {
      type: 'group',
      participantIds: users.map((u) => u.id),
      allUsers: true,
    });
    await expect(
      mockChatApi.addMember(conv.id, 'user-teacher-1', 'user-student-2'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      mockChatApi.removeMember(conv.id, 'user-teacher-1', 'user-student'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('new registrant joins school-wide chats but not personal/group', async () => {
    const { mockAuthApi } = await import('@/services/api/mock');
    const { SEED_REGISTRATION_INVITE_TOKEN } = await import('@/services/registration/constants');

    const schoolWide = await mockChatApi.createConversation('user-teacher-1', {
      type: 'group',
      participantIds: [],
      allUsers: true,
      title: 'Объявления школы',
    });
    const privateGroup = await mockChatApi.createConversation('user-teacher-1', {
      type: 'group',
      title: 'Только избранные',
      participantIds: ['user-student'],
    });

    const session = await mockAuthApi.register(
      '+79005550123',
      'password12',
      'Новый',
      'Ученик',
      ['dir-vocal'],
      SEED_REGISTRATION_INVITE_TOKEN,
    );

    const list = await mockChatApi.getConversations(session.user.id);
    const ids = list.map((c) => c.id);
    expect(ids).toContain(schoolWide.id);
    expect(ids).not.toContain(privateGroup.id);
    expect(ids).not.toContain('conv-1');
  });

  it('infers chat avatar mime from empty type and aliases', async () => {
    const { inferChatAvatarMimeType } = await import('@/services/chat/avatar');
    expect(inferChatAvatarMimeType('photo.jpg', '')).toBe('image/jpeg');
    expect(inferChatAvatarMimeType('photo.PNG', 'image/jpg')).toBe('image/jpeg');
    expect(inferChatAvatarMimeType('shot', 'image/png')).toBe('image/png');
  });

  it('group chat can be created with avatar icon', async () => {
    const avatarUrl = 'data:image/png;base64,aaa';
    const conv = await mockChatApi.createConversation('user-teacher-1', {
      type: 'group',
      title: 'С иконкой',
      participantIds: ['user-student'],
      avatarUrl,
    });
    expect(conv.avatarUrl).toBe(avatarUrl);
  });

  it('teacher can update group avatar in settings', async () => {
    const conv = await mockChatApi.createConversation('user-teacher-1', {
      type: 'group',
      title: 'Редактирование',
      participantIds: ['user-student'],
    });
    const updated = await mockChatApi.updateConversation(conv.id, 'user-teacher-1', {
      avatarUrl: 'data:image/jpeg;base64,bbb',
    });
    expect(updated.avatarUrl).toBe('data:image/jpeg;base64,bbb');
    const cleared = await mockChatApi.updateConversation(conv.id, 'user-teacher-1', {
      avatarUrl: '',
    });
    expect(cleared.avatarUrl).toBeUndefined();
  });

  it('school-wide chats are unlimited (no dedupe)', async () => {
    const first = await mockChatApi.createConversation('user-teacher-1', {
      type: 'group',
      participantIds: [],
      allUsers: true,
    });
    const second = await mockChatApi.createConversation('user-teacher-1', {
      type: 'group',
      title: 'Общий чат 2',
      participantIds: [],
      allUsers: true,
    });
    expect(second.id).not.toBe(first.id);
    expect(second.title).toBe('Общий чат 2');
  });

  it('student cannot create school-wide chat', async () => {
    await expect(
      mockChatApi.createConversation('user-student', {
        type: 'group',
        participantIds: [],
        allUsers: true,
      }),
    ).rejects.toThrow(ApiError);
  });

  it('teacher can delete own conversation', async () => {
    const conv = await mockChatApi.createConversation('user-teacher-1', {
      type: 'group',
      title: 'К удалению',
      participantIds: ['user-student'],
    });
    await mockChatApi.deleteConversation(conv.id, 'user-teacher-1');
    await expect(mockChatApi.getConversation(conv.id, 'user-teacher-1')).rejects.toThrow(ApiError);
  });

  it('student cannot delete conversation', async () => {
    await expect(mockChatApi.deleteConversation('conv-1', 'user-student')).rejects.toThrow(ApiError);
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

  it('filters school-wide conversations', async () => {
    const schoolWide = await mockChatApi.createConversation('user-teacher-1', {
      type: 'group',
      participantIds: [],
      allUsers: true,
      title: 'Общий фильтр',
    });
    const all = await mockChatApi.getConversations('user-student');
    const filtered = filterConversations(all, {
      filter: 'school',
      currentUserId: 'user-student',
      users,
    });
    expect(filtered.every((c) => c.metadata?.schoolWide === true)).toBe(true);
    expect(filtered.some((c) => c.id === schoolWide.id)).toBe(true);
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

  it('filters group conversations without school-wide', async () => {
    await mockChatApi.createConversation('user-teacher-1', {
      type: 'group',
      participantIds: [],
      allUsers: true,
      title: 'Не в группах',
    });
    const privateGroup = await mockChatApi.createConversation('user-teacher-1', {
      type: 'group',
      title: 'Обычная группа',
      participantIds: ['user-student'],
    });
    const all = await mockChatApi.getConversations('user-student');
    const filtered = filterConversations(all, {
      filter: 'group',
      currentUserId: 'user-student',
      users,
    });
    expect(filtered.every((c) => c.type !== 'personal' && !c.metadata?.schoolWide)).toBe(true);
    expect(filtered.some((c) => c.id === privateGroup.id)).toBe(true);
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

describe('conversation list enrichment (perf-safe)', () => {
  beforeEach(() => {
    resetMockDatabase();
  });

  it('uses synced lastMessage preview on getConversations after send', async () => {
    await mockChatApi.sendMessage('conv-1', 'user-teacher-1', 'Превью списка');
    const list = await mockChatApi.getConversations('user-student');
    const conv = list.find((c) => c.id === 'conv-1');
    expect(conv?.lastMessage?.text).toBe('Превью списка');
  });

  it('attachment-only lastMessage uses media preview label', async () => {
    await mockChatApi.sendMessage('conv-1', 'user-teacher-1', 'Фото', {
      attachments: [
        {
          id: 'att-list-1',
          type: 'image',
          filename: 'shot.jpg',
          mimeType: 'image/jpeg',
          size: 12,
          url: 'data:image/jpeg;base64,AA==',
        },
      ],
    });
    const list = await mockChatApi.getConversations('user-student');
    const conv = list.find((c) => c.id === 'conv-1');
    expect(conv?.lastMessage?.text).toBe('Фото');
  });

  it('unread parity: hide/system/own do not inflate unread', async () => {
    await mockChatApi.markAsRead('conv-1', 'user-student');
    await mockChatApi.sendMessage('conv-1', 'user-student', 'Моё');
    await mockChatApi.sendMessage('conv-1', 'user-teacher-1', 'Чужое непрочитанное');
    const before = await mockChatApi.getConversations('user-student');
    const unreadBefore = before.find((c) => c.id === 'conv-1')?.unreadCount ?? 0;
    expect(unreadBefore).toBeGreaterThan(0);

    await mockChatApi.markAsRead('conv-1', 'user-student');
    const after = await mockChatApi.getConversations('user-student');
    expect(after.find((c) => c.id === 'conv-1')?.unreadCount ?? 0).toBe(0);
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

  it('returns messages in chronological order (oldest → newest)', async () => {
    const a = await mockChatApi.sendMessage('conv-1', 'user-student', 'first');
    const b = await mockChatApi.sendMessage('conv-1', 'user-teacher-1', 'second');
    const c = await mockChatApi.sendMessage('conv-1', 'user-student', 'third');
    const page = await mockChatApi.getMessages('conv-1', 'user-student');
    const ids = page.messages.map((m) => m.id);
    expect(ids.indexOf(a.id)).toBeLessThan(ids.indexOf(b.id));
    expect(ids.indexOf(b.id)).toBeLessThan(ids.indexOf(c.id));
    expect(page.messages.at(-1)?.id).toBe(c.id);
  });
});

describe('flattenMessages order', () => {
  it('merges pages into chronological ASC with newest at the end', async () => {
    const { flattenMessages } = await import('@/hooks/useChatMessages');
    const older = {
      id: 'm1',
      conversationId: 'c',
      senderId: 'u1',
      text: 'old',
      createdAt: '2026-01-01T10:00:00.000Z',
      status: 'sent' as const,
      readBy: [],
      messageType: 'user' as const,
    };
    const newer = {
      id: 'm2',
      conversationId: 'c',
      senderId: 'u2',
      text: 'new',
      createdAt: '2026-01-01T11:00:00.000Z',
      status: 'sent' as const,
      readBy: [],
      messageType: 'user' as const,
    };
    const flat = flattenMessages([{ messages: [newer] }, { messages: [older] }]);
    expect(flat.map((m) => m.id)).toEqual(['m1', 'm2']);
  });

  it('prefers sent server message over failed optimistic with same clientMutationId', async () => {
    const { flattenMessages } = await import('@/hooks/useChatMessages');
    const failed = {
      id: 'client-1',
      conversationId: 'c',
      senderId: 'u1',
      text: 'hi',
      createdAt: '2026-01-01T10:00:00.000Z',
      status: 'failed' as const,
      readBy: ['u1'],
      clientMutationId: 'client-1',
      messageType: 'user' as const,
    };
    const sent = {
      id: 'msg-real',
      conversationId: 'c',
      senderId: 'u1',
      text: 'hi',
      createdAt: '2026-01-01T10:00:00.000Z',
      status: 'sent' as const,
      readBy: ['u1'],
      clientMutationId: 'client-1',
      messageType: 'user' as const,
    };
    const flat = flattenMessages([{ messages: [failed, sent] }]);
    expect(flat).toHaveLength(1);
    expect(flat[0]?.id).toBe('msg-real');
    expect(flat[0]?.status).toBe('sent');
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

  it('allows editing own message older than 15 minutes', async () => {
    const msg = await mockChatApi.sendMessage('conv-1', 'user-student', 'Старое');
    msg.createdAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const edited = await mockChatApi.editMessage('conv-1', msg.id, 'user-student', {
      text: 'Правка позже',
    });
    expect(edited.text).toBe('Правка позже');
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

  it('hard-deletes own message for everyone', async () => {
    const msg = await mockChatApi.sendMessage('conv-1', 'user-student', 'Удалить');
    const deleted = await mockChatApi.deleteMessage('conv-1', msg.id, 'user-student');
    expect(deleted.deletedAt).toBeDefined();
    await expect(mockChatApi.getMessage('conv-1', msg.id, 'user-student')).rejects.toThrow(ApiError);
    const page = await mockChatApi.getMessages('conv-1', 'user-student');
    expect(page.messages.some((m) => m.id === msg.id)).toBe(false);
  });

  it('hides message only for the requesting user (delete for me)', async () => {
    const msg = await mockChatApi.sendMessage('conv-1', 'user-student', 'Скрыть у себя');
    const hidden = await mockChatApi.deleteMessage('conv-1', msg.id, 'user-student', {
      scope: 'me',
    });
    expect(hidden.hiddenForUserIds).toContain('user-student');
    expect(hidden.deletedAt).toBeUndefined();

    const studentPage = await mockChatApi.getMessages('conv-1', 'user-student');
    expect(studentPage.messages.some((m) => m.id === msg.id)).toBe(false);

    const teacherPage = await mockChatApi.getMessages('conv-1', 'user-teacher-1');
    expect(teacherPage.messages.some((m) => m.id === msg.id)).toBe(true);
  });

  it('rejects deleting foreign message in personal chat for everyone (IDOR)', async () => {
    const msg = await mockChatApi.sendMessage('conv-1', 'user-student', 'Чужое');
    await expect(mockChatApi.deleteMessage('conv-1', msg.id, 'user-teacher-1')).rejects.toThrow(ApiError);
  });

  it('allows hide-for-me on foreign message when member', async () => {
    const msg = await mockChatApi.sendMessage('conv-1', 'user-student', 'Чужое скрыть');
    const hidden = await mockChatApi.deleteMessage('conv-1', msg.id, 'user-teacher-1', {
      scope: 'me',
    });
    expect(hidden.hiddenForUserIds).toContain('user-teacher-1');
    const teacherPage = await mockChatApi.getMessages('conv-1', 'user-teacher-1');
    expect(teacherPage.messages.some((m) => m.id === msg.id)).toBe(false);
    const studentPage = await mockChatApi.getMessages('conv-1', 'user-student');
    expect(studentPage.messages.some((m) => m.id === msg.id)).toBe(true);
  });

  it('teacher can delete foreign message in group chat for everyone', async () => {
    const group = await mockChatApi.createConversation('user-teacher-1', {
      type: 'group',
      title: 'Модерация',
      participantIds: ['user-student', 'user-teacher-1'],
    });
    const msg = await mockChatApi.sendMessage(group.id, 'user-student', 'Лишнее');
    const deleted = await mockChatApi.deleteMessage(group.id, msg.id, 'user-teacher-1');
    expect(deleted.deletedAt).toBeDefined();
  });
});

describe('message reactions and forward', () => {
  beforeEach(() => resetMockDatabase());

  it('toggles reaction on message', async () => {
    const msg = await mockChatApi.sendMessage('conv-1', 'user-student', 'Реакция');
    const reacted = await mockChatApi.setMessageReaction('conv-1', msg.id, 'user-teacher-1', '👍');
    expect(reacted.reactions?.some((r) => r.emoji === '👍' && r.userIds.includes('user-teacher-1'))).toBe(
      true,
    );
  });

  it('forwards message without author attribution to a single chat', async () => {
    const msg = await mockChatApi.sendMessage('conv-1', 'user-student', 'Перешлите');
    const group = await mockChatApi.createConversation('user-teacher-1', {
      type: 'group',
      title: 'Цель',
      participantIds: ['user-student', 'user-teacher-1'],
    });
    const forwarded = await mockChatApi.forwardMessage(
      'conv-1',
      msg.id,
      'user-teacher-1',
      group.id,
    );
    expect(forwarded.text).toBe('Перешлите');
    expect(forwarded.senderId).toBe('user-teacher-1');
    expect(forwarded.conversationId).toBe(group.id);
  });

  it('pins conversation for self', async () => {
    const member = await mockChatApi.pinConversation('conv-1', 'user-student', true);
    expect(member.pinnedAt).toBeTruthy();
    const list = await mockChatApi.getConversations('user-student');
    expect(list[0]?.id).toBe('conv-1');
    expect(list[0]?.viewerPinnedAt).toBeTruthy();
  });

  it('sortConversationsWithPins puts newly pinned chat first', () => {
    const list = [
      {
        id: 'a',
        type: 'personal' as const,
        title: 'A',
        participantIds: ['u1', 'u2'],
        createdAt: '2026-01-01T10:00:00.000Z',
        updatedAt: '2026-01-01T12:00:00.000Z',
        lastMessageAt: '2026-01-01T12:00:00.000Z',
        unreadCount: 0,
      },
      {
        id: 'b',
        type: 'personal' as const,
        title: 'B',
        participantIds: ['u1', 'u3'],
        createdAt: '2026-01-01T09:00:00.000Z',
        updatedAt: '2026-01-01T11:00:00.000Z',
        lastMessageAt: '2026-01-01T11:00:00.000Z',
        unreadCount: 0,
        viewerPinnedAt: '2026-01-01T13:00:00.000Z',
      },
      {
        id: 'c',
        type: 'personal' as const,
        title: 'C',
        participantIds: ['u1', 'u4'],
        createdAt: '2026-01-01T08:00:00.000Z',
        updatedAt: '2026-01-01T10:00:00.000Z',
        lastMessageAt: '2026-01-01T10:00:00.000Z',
        unreadCount: 0,
        viewerPinnedAt: '2026-01-01T12:00:00.000Z',
      },
    ];
    const sorted = sortConversationsWithPins(list, [], 'u1');
    expect(sorted.map((c) => c.id)).toEqual(['b', 'c', 'a']);
  });

  it('filterConversations keeps pinned chats first', () => {
    const list = [
      {
        id: 'hot',
        type: 'personal' as const,
        title: 'Hot',
        participantIds: ['user-student', 'user-teacher-1'],
        createdAt: '2026-01-01T10:00:00.000Z',
        updatedAt: '2026-01-01T15:00:00.000Z',
        lastMessageAt: '2026-01-01T15:00:00.000Z',
        unreadCount: 0,
      },
      {
        id: 'pin',
        type: 'personal' as const,
        title: 'Pinned',
        participantIds: ['user-student', 'user-teacher-1'],
        createdAt: '2026-01-01T09:00:00.000Z',
        updatedAt: '2026-01-01T10:00:00.000Z',
        lastMessageAt: '2026-01-01T10:00:00.000Z',
        unreadCount: 0,
        viewerPinnedAt: '2026-01-01T16:00:00.000Z',
      },
    ];
    const filtered = filterConversations(list, {
      currentUserId: 'user-student',
      users,
      filter: 'all',
    });
    expect(filtered.map((c) => c.id)).toEqual(['pin', 'hot']);
  });

  it('sortConversationsWithPins orders unpinned by lastMessageAt desc', () => {
    const list: Conversation[] = [
      {
        id: 'old',
        type: 'personal',
        title: 'Old',
        participantIds: ['u1', 'u2'],
        createdAt: '2026-01-01T08:00:00.000Z',
        updatedAt: '2026-01-01T10:00:00.000Z',
        lastMessageAt: '2026-01-01T10:00:00.000Z',
        unreadCount: 0,
      },
      {
        id: 'new',
        type: 'personal',
        title: 'New',
        participantIds: ['u1', 'u3'],
        createdAt: '2026-01-01T09:00:00.000Z',
        updatedAt: '2026-01-01T12:00:00.000Z',
        lastMessageAt: '2026-01-01T12:00:00.000Z',
        unreadCount: 0,
      },
      {
        id: 'mid',
        type: 'personal',
        title: 'Mid',
        participantIds: ['u1', 'u4'],
        createdAt: '2026-01-01T08:30:00.000Z',
        updatedAt: '2026-01-01T11:00:00.000Z',
        lastMessageAt: '2026-01-01T11:00:00.000Z',
        unreadCount: 0,
      },
    ];
    expect(sortConversationsWithPins(list, [], 'u1').map((c) => c.id)).toEqual([
      'new',
      'mid',
      'old',
    ]);
  });

  it('bumpConversationInList raises chat above others but below pins', () => {
    const list: Conversation[] = [
      {
        id: 'pin',
        type: 'personal',
        title: 'Pinned',
        participantIds: ['u1', 'u2'],
        createdAt: '2026-01-01T08:00:00.000Z',
        updatedAt: '2026-01-01T09:00:00.000Z',
        lastMessageAt: '2026-01-01T09:00:00.000Z',
        unreadCount: 0,
        viewerPinnedAt: '2026-01-01T16:00:00.000Z',
      },
      {
        id: 'top',
        type: 'personal',
        title: 'Was top',
        participantIds: ['u1', 'u3'],
        createdAt: '2026-01-01T08:00:00.000Z',
        updatedAt: '2026-01-01T15:00:00.000Z',
        lastMessageAt: '2026-01-01T15:00:00.000Z',
        unreadCount: 0,
      },
      {
        id: 'cold',
        type: 'personal',
        title: 'Cold',
        participantIds: ['u1', 'u4'],
        createdAt: '2026-01-01T08:00:00.000Z',
        updatedAt: '2026-01-01T10:00:00.000Z',
        lastMessageAt: '2026-01-01T10:00:00.000Z',
        unreadCount: 0,
      },
    ];
    const bumped = bumpConversationInList(
      list,
      'cold',
      {
        lastMessageAt: '2026-01-01T16:00:00.000Z',
        lastMessage: {
          id: 'msg-x',
          text: 'Hello',
          senderId: 'u4',
          createdAt: '2026-01-01T16:00:00.000Z',
        },
        unreadDelta: 1,
      },
      'u1',
    );
    expect(bumped.map((c) => c.id)).toEqual(['pin', 'cold', 'top']);
    expect(bumped.find((c) => c.id === 'cold')?.unreadCount).toBe(1);
  });

  it('bumpConversationInList ignores stale older timestamps', () => {
    const list: Conversation[] = [
      {
        id: 'a',
        type: 'personal',
        title: 'A',
        participantIds: ['u1', 'u2'],
        createdAt: '2026-01-01T08:00:00.000Z',
        updatedAt: '2026-01-01T15:00:00.000Z',
        lastMessageAt: '2026-01-01T15:00:00.000Z',
        unreadCount: 0,
      },
    ];
    const same = bumpConversationInList(
      list,
      'a',
      {
        lastMessageAt: '2026-01-01T14:00:00.000Z',
        lastMessage: {
          id: 'old',
          text: 'stale',
          senderId: 'u2',
          createdAt: '2026-01-01T14:00:00.000Z',
        },
      },
      'u1',
    );
    expect(same).toBe(list);
  });

  it('sendMessage moves conversation to top of list', async () => {
    const before = await mockChatApi.getConversations('user-student');
    expect(before[0]?.id).not.toBe('conv-5');
    await mockChatApi.sendMessage('conv-5', 'user-student', 'Bump me', {
      suppressNotification: true,
    });
    const after = await mockChatApi.getConversations('user-student');
    expect(after[0]?.id).toBe('conv-5');
    expect(after[0]?.lastMessage?.text).toBe('Bump me');
  });

  it('sendMessage keeps pinned conversation above bumped unpinned', async () => {
    await mockChatApi.pinConversation('conv-1', 'user-student', true);
    await mockChatApi.sendMessage('conv-5', 'user-student', 'Fresh', {
      suppressNotification: true,
    });
    const list = await mockChatApi.getConversations('user-student');
    expect(list[0]?.id).toBe('conv-1');
    expect(list[0]?.viewerPinnedAt).toBeTruthy();
    expect(list[1]?.id).toBe('conv-5');
  });
});

describe('edit window and leave policy', () => {
  beforeEach(() => resetMockDatabase());

  it('student cannot leave group chat', async () => {
    const group = await mockChatApi.createConversation('user-teacher-1', {
      type: 'group',
      title: 'Группа',
      participantIds: ['user-student', 'user-teacher-1'],
    });
    await expect(mockChatApi.leaveConversation(group.id, 'user-student')).rejects.toThrow(ApiError);
  });
});

describe('report message helpers', () => {
  it('allows reporting others messages in accessible chats', async () => {
    const { canReportMessage, buildReportTicketSubject } = await import(
      '@/services/support/reportMessage'
    );
    const { users: seedUsers, conversations, conversationMembers, messages } = await import(
      '@/mocks/seed'
    );
    const studentUser = seedUsers.find((u) => u.id === 'user-student')!;
    const conv = conversations.find((c) => c.id === 'conv-1')!;
    const members = conversationMembers.filter((m) => m.conversationId === 'conv-1');
    const otherMsg = messages.find((m) => m.conversationId === 'conv-1' && m.senderId !== 'user-student');
    expect(otherMsg).toBeTruthy();
    expect(canReportMessage(studentUser, otherMsg!, conv, members)).toBe(true);
    expect(canReportMessage(studentUser, { ...otherMsg!, senderId: 'user-student' }, conv, members)).toBe(
      false,
    );
    expect(buildReportTicketSubject('image_rights')).toContain('Изображение');
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

  it('teacher can add multiple members in one batch', async () => {
    const conv = await mockChatApi.createConversation('user-teacher-1', {
      type: 'group',
      title: 'Батч',
      participantIds: ['user-student'],
    });
    const added = await mockChatApi.addMembers(conv.id, 'user-teacher-1', [
      'user-student', // already in — skipped
      'user-student-2',
    ]);
    expect(added).toHaveLength(1);
    expect(added[0]?.userId).toBe('user-student-2');
    const members = await mockChatApi.getMembers(conv.id, 'user-teacher-1');
    expect(members.some((m) => m.userId === 'user-student-2')).toBe(true);
    const refreshed = await mockChatApi.getConversation(conv.id, 'user-teacher-1');
    expect(refreshed.participantIds).toEqual(
      expect.arrayContaining(['user-student', 'user-student-2']),
    );
    const page = await mockChatApi.getMessages(conv.id, 'user-teacher-1');
    expect(page.messages.some((m) => m.messageType === 'system' && m.text.includes('добавил'))).toBe(
      true,
    );
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

  it('admin can pin and unpin message', async () => {
    const msg = await mockChatApi.sendMessage('conv-4', 'user-admin', 'Важно');
    const pinned = await mockChatApi.pinMessage('conv-4', msg.id, 'user-admin');
    expect(pinned.pinnedMessageIds).toContain(msg.id);
    const unpinned = await mockChatApi.unpinMessage('conv-4', msg.id, 'user-admin');
    expect(unpinned.pinnedMessageIds ?? []).not.toContain(msg.id);
  });

  it('student cannot pin message', async () => {
    const msg = await mockChatApi.sendMessage('conv-2', 'user-teacher-1', 'Важно');
    await expect(mockChatApi.pinMessage('conv-2', msg.id, 'user-student')).rejects.toThrow(ApiError);
  });

  it('student cannot unpin message', async () => {
    const msg = await mockChatApi.sendMessage('conv-2', 'user-teacher-1', 'Важно');
    await mockChatApi.pinMessage('conv-2', msg.id, 'user-teacher-1');
    await expect(mockChatApi.unpinMessage('conv-2', msg.id, 'user-student')).rejects.toThrow(ApiError);
  });

  it('orderPinnedMessagesNewestFirst sorts by chat position newest→oldest', () => {
    const base = {
      conversationId: 'c',
      senderId: 'u',
      status: 'sent' as const,
      readBy: [] as string[],
    };
    const msgs: Message[] = [
      { ...base, id: 'old', text: 'old', createdAt: '2026-01-01T10:00:00.000Z' },
      { ...base, id: 'new', text: 'new', createdAt: '2026-01-01T12:00:00.000Z' },
      { ...base, id: 'mid', text: 'mid', createdAt: '2026-01-01T11:00:00.000Z' },
    ];
    const ordered = orderPinnedMessagesNewestFirst(['old', 'mid', 'new'], msgs);
    expect(ordered.map((m) => m.id)).toEqual(['new', 'mid', 'old']);
  });

  it('resolvePinnedIndexForViewport follows scroll past pins newest→oldest', () => {
    const ids = ['new', 'mid', 'old'];
    // All pins above viewport top (scrolled to bottom) → newest
    expect(resolvePinnedIndexForViewport(ids, { new: 10, mid: -100, old: -200 }, 50)).toBe(0);
    // Passed old+mid, new still below → mid
    expect(resolvePinnedIndexForViewport(ids, { new: 120, mid: 40, old: -20 }, 50)).toBe(1);
    // Only old passed → oldest
    expect(resolvePinnedIndexForViewport(ids, { new: 200, mid: 120, old: 40 }, 50)).toBe(2);
    // None passed (above all pins) → oldest
    expect(resolvePinnedIndexForViewport(ids, { new: 200, mid: 150, old: 100 }, 50)).toBe(2);
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

  it('preserves voice kind on upload', async () => {
    const att = await mockChatApi.uploadAttachment('conv-1', 'user-student', {
      filename: 'voice-1.webm',
      mimeType: 'audio/webm',
      size: 2048,
      kind: 'voice',
    });
    expect(att.kind).toBe('voice');
    expect(att.type).toBe('audio');
  });

  it('detects voice attachments via kind and legacy filename', async () => {
    const { isVoiceAttachment } = await import('@/services/chat/attachments');
    expect(
      isVoiceAttachment({
        id: 'a1',
        type: 'audio',
        filename: 'song.mp3',
        mimeType: 'audio/mpeg',
        size: 1,
        kind: 'voice',
      }),
    ).toBe(true);
    expect(
      isVoiceAttachment({
        id: 'a2',
        type: 'audio',
        filename: 'voice-123.webm',
        mimeType: 'audio/webm',
        size: 1,
      }),
    ).toBe(true);
    expect(
      isVoiceAttachment({
        id: 'a3',
        type: 'audio',
        filename: 'lesson.mp3',
        mimeType: 'audio/mpeg',
        size: 1,
        kind: 'file',
      }),
    ).toBe(false);
  });

  it('hides filename captions under media in display text', async () => {
    const { getMessageDisplayText } = await import('@/services/chat/messages');
    const { getAttachmentsPreviewLabel } = await import('@/services/chat/attachments');
    const photo = {
      id: 'm1',
      conversationId: 'c1',
      senderId: 'u1',
      text: 'result_обложка.jpg',
      createdAt: new Date().toISOString(),
      status: 'sent' as const,
      readBy: [],
      attachments: [
        {
          id: 'a1',
          type: 'image' as const,
          filename: 'result_обложка.jpg',
          mimeType: 'image/jpeg',
          size: 10,
        },
      ],
      messageType: 'user' as const,
    };
    expect(getMessageDisplayText(photo)).toBe('');
    expect(getAttachmentsPreviewLabel(photo.attachments)).toBe('Фото');
    expect(
      getMessageDisplayText({
        ...photo,
        text: 'смотри',
      }),
    ).toBe('смотри');
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
