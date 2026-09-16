import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { MESSAGE_PAGE_SIZE } from '@/services/chat/constants';
import { actsAsTeacher } from '@/permissions';
import { compareIsoDates } from '@/utils/dates';
import type { Conversation, User, UserRole } from '@/types';

/** How many recent chats get a first message page warmed after cold start. */
export const WARM_CHAT_MESSAGE_LIMIT = 8;

export function selectConversationsForMessageWarm(
  conversations: Conversation[],
  limit = WARM_CHAT_MESSAGE_LIMIT,
): string[] {
  return [...conversations]
    .sort((a, b) => {
      const aAt = a.lastMessageAt ?? a.updatedAt ?? '';
      const bAt = b.lastMessageAt ?? b.updatedAt ?? '';
      return compareIsoDates(bAt, aAt) || a.id.localeCompare(b.id);
    })
    .slice(0, Math.max(0, limit))
    .map((c) => c.id);
}

export type WarmAppCacheUser = Pick<User, 'id' | 'role'>;

/**
 * Prefetch shell + main tabs so first navigation after cold start is cache-hit.
 * Safe to call repeatedly — TanStack dedupes in-flight queries.
 */
export async function warmAppCache(
  queryClient: QueryClient,
  user: WarmAppCacheUser,
): Promise<void> {
  const userId = user.id;
  const role = user.role as UserRole;
  const teacherView = actsAsTeacher(role);

  const shell: Promise<unknown>[] = [
    queryClient.prefetchQuery({
      queryKey: ['conversations', userId],
      queryFn: () => api.chat.getConversations(userId),
    }),
    queryClient.prefetchQuery({
      queryKey: ['notifications', userId],
      queryFn: () => api.notifications.getNotifications(userId),
    }),
    queryClient.prefetchQuery({
      queryKey: ['chat-unread', userId],
      queryFn: () => api.chat.getTotalUnread(userId),
    }),
    queryClient.prefetchQuery({
      queryKey: ['directions'],
      queryFn: () => api.lessons.getDirections(),
    }),
    queryClient.prefetchQuery({
      queryKey: ['teachers'],
      queryFn: () => api.lessons.getTeachers(),
    }),
    queryClient.prefetchQuery({
      queryKey: ['school-settings'],
      queryFn: () => api.schoolSettings.getSchoolSettings(userId),
    }),
    queryClient.prefetchQuery({
      queryKey: ['events', userId],
      queryFn: () => api.events.getEvents(userId),
    }),
    queryClient.prefetchQuery({
      queryKey: ['lessons', 'upcoming', userId, role],
      queryFn: async () => {
        const base = { requesterId: userId };
        if (teacherView) {
          return api.lessons.getLessons({ ...base, teacherId: userId });
        }
        return api.lessons.getLessons({ ...base, studentId: userId });
      },
    }),
    queryClient.prefetchQuery({
      queryKey: ['lessons', 'list', userId, role],
      queryFn: async () => {
        const base = { requesterId: userId };
        if (teacherView) {
          return api.lessons.getLessons({ ...base, teacherId: userId });
        }
        return api.lessons.getLessons({ ...base, studentId: userId });
      },
    }),
    queryClient.prefetchQuery({
      queryKey: ['assignments', userId, role],
      queryFn: () => api.assignments.getAssignments({ requesterId: userId }),
    }),
  ];

  if (role !== 'student') {
    shell.push(
      queryClient.prefetchQuery({
        queryKey: ['users'],
        queryFn: () => api.users.getAllUsers(userId),
      }),
    );
  }

  if (role === 'teacher' || role === 'admin') {
    shell.push(
      queryClient.prefetchQuery({
        queryKey: ['assignment-groups', userId],
        queryFn: () => api.assignmentGroups.getGroups(userId),
      }),
    );
  }

  await Promise.allSettled(shell);

  const conversations = queryClient.getQueryData<Conversation[]>(['conversations', userId]);
  if (!conversations?.length) return;

  const warmIds = selectConversationsForMessageWarm(conversations);
  await Promise.allSettled(
    warmIds.map((conversationId) =>
      queryClient.prefetchInfiniteQuery({
        queryKey: ['messages', conversationId, userId],
        queryFn: ({ pageParam }) =>
          api.chat.getMessages(conversationId, userId, {
            limit: MESSAGE_PAGE_SIZE,
            cursor: pageParam as string | undefined,
          }),
        initialPageParam: undefined as string | undefined,
      }),
    ),
  );
}
