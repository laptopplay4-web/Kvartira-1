import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  selectConversationsForMessageWarm,
  warmAppCache,
  WARM_CHAT_MESSAGE_LIMIT,
} from '@/services/cache/warmAppCache';
import { shouldPersistQuery, QUERY_CACHE_STORAGE_KEY } from '@/app/queryPersist';
import type { Conversation } from '@/types';
import type { Query } from '@tanstack/react-query';

vi.mock('@/services/api', () => ({
  api: {
    chat: {
      getConversations: vi.fn(async () => [
        {
          id: 'c-new',
          type: 'group',
          title: 'New',
          participantIds: [],
          createdAt: '2026-09-16T12:00:00.000Z',
          updatedAt: '2026-09-16T12:00:00.000Z',
          lastMessageAt: '2026-09-16T12:00:00.000Z',
        },
        {
          id: 'c-old',
          type: 'group',
          title: 'Old',
          participantIds: [],
          createdAt: '2026-09-01T12:00:00.000Z',
          updatedAt: '2026-09-01T12:00:00.000Z',
          lastMessageAt: '2026-09-01T12:00:00.000Z',
        },
      ]),
      getTotalUnread: vi.fn(async () => 0),
      getMessages: vi.fn(async () => ({ messages: [], hasMore: false })),
    },
    notifications: {
      getNotifications: vi.fn(async () => []),
    },
    lessons: {
      getDirections: vi.fn(async () => []),
      getTeachers: vi.fn(async () => []),
      getLessons: vi.fn(async () => []),
    },
    events: {
      getEvents: vi.fn(async () => []),
    },
    assignments: {
      getAssignments: vi.fn(async () => []),
    },
    assignmentGroups: {
      getGroups: vi.fn(async () => []),
    },
    schoolSettings: {
      getSchoolSettings: vi.fn(async () => ({
        name: 'Квартира',
        tagline: '',
        about: '',
        contacts: {},
        socialLinks: {},
      })),
    },
    users: {
      getAllUsers: vi.fn(async () => []),
    },
  },
}));

function mockQuery(key: unknown[], status: 'success' | 'pending' = 'success'): Query {
  return {
    queryKey: key,
    state: { status },
  } as unknown as Query;
}

describe('query persist filter', () => {
  it('persists shell keys and skips messages/security', () => {
    expect(shouldPersistQuery(mockQuery(['conversations', 'u1']))).toBe(true);
    expect(shouldPersistQuery(mockQuery(['lessons', 'upcoming', 'u1', 'student']))).toBe(true);
    expect(shouldPersistQuery(mockQuery(['messages', 'c1', 'u1']))).toBe(false);
    expect(shouldPersistQuery(mockQuery(['security', 'sessions', 'u1']))).toBe(false);
    expect(shouldPersistQuery(mockQuery(['conversations', 'u1'], 'pending'))).toBe(false);
  });

  it('exports stable storage key', () => {
    expect(QUERY_CACHE_STORAGE_KEY).toBe('kvartira-query-cache');
  });
});

describe('selectConversationsForMessageWarm', () => {
  it('orders by lastMessageAt and respects limit', () => {
    const list: Conversation[] = [
      {
        id: 'a',
        type: 'personal',
        title: 'A',
        participantIds: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        lastMessageAt: '2026-09-10T00:00:00.000Z',
      },
      {
        id: 'b',
        type: 'personal',
        title: 'B',
        participantIds: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        lastMessageAt: '2026-09-16T00:00:00.000Z',
      },
      {
        id: 'c',
        type: 'personal',
        title: 'C',
        participantIds: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-09-15T00:00:00.000Z',
      },
    ];
    expect(selectConversationsForMessageWarm(list, 2)).toEqual(['b', 'c']);
    expect(selectConversationsForMessageWarm(list).length).toBeLessThanOrEqual(WARM_CHAT_MESSAGE_LIMIT);
  });
});

describe('warmAppCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefetches shell queries and recent message pages', async () => {
    const { api } = await import('@/services/api');
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await warmAppCache(qc, { id: 'user-1', role: 'student' });

    expect(api.chat.getConversations).toHaveBeenCalledWith('user-1');
    expect(api.notifications.getNotifications).toHaveBeenCalledWith('user-1');
    expect(api.events.getEvents).toHaveBeenCalledWith('user-1');
    expect(api.lessons.getLessons).toHaveBeenCalled();
    expect(api.assignments.getAssignments).toHaveBeenCalledWith({ requesterId: 'user-1' });
    expect(api.users.getAllUsers).not.toHaveBeenCalled();
    expect(api.chat.getMessages).toHaveBeenCalled();
    expect(qc.getQueryData(['conversations', 'user-1'])).toBeTruthy();
    expect(qc.getQueryData(['messages', 'c-new', 'user-1'])).toBeTruthy();
  });

  it('prefetches users directory for teacher', async () => {
    const { api } = await import('@/services/api');
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await warmAppCache(qc, { id: 'teacher-1', role: 'teacher' });

    expect(api.users.getAllUsers).toHaveBeenCalledWith('teacher-1');
    expect(api.assignmentGroups.getGroups).toHaveBeenCalledWith('teacher-1');
  });
});
