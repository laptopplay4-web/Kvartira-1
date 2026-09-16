import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { actsAsTeacher } from '@/permissions';
import type { User } from '@/types';

/**
 * Prefetch typical data for a shell route so navigation feels instant.
 * Safe no-op when offline or without a session user.
 */
export function prefetchRouteData(
  queryClient: QueryClient,
  path: string,
  user: User | null | undefined,
): void {
  if (!user?.id) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  const base = path.split('?')[0] ?? path;
  const teacherView = actsAsTeacher(user.role);

  const prefetchLessons = (listKey: 'upcoming' | 'list') => {
    void queryClient.prefetchQuery({
      queryKey: ['lessons', listKey, user.id, user.role],
      queryFn: async () => {
        const baseFilters = { requesterId: user.id };
        if (teacherView) {
          return api.lessons.getLessons({ ...baseFilters, teacherId: user.id });
        }
        return api.lessons.getLessons({ ...baseFilters, studentId: user.id });
      },
    });
  };

  if (base === '/home' || base.startsWith('/home/')) {
    prefetchLessons('upcoming');
    void queryClient.prefetchQuery({
      queryKey: ['events', user.id],
      queryFn: () => api.events.getEvents(user.id),
    });
    return;
  }

  if (base === '/lessons' || base.startsWith('/lessons/')) {
    prefetchLessons('list');
    return;
  }

  if (base === '/chat' || base.startsWith('/chat/')) {
    void queryClient.prefetchQuery({
      queryKey: ['conversations', user.id],
      queryFn: () => api.chat.getConversations(user.id),
    });
    return;
  }

  if (base === '/events' || base.startsWith('/events/')) {
    void queryClient.prefetchQuery({
      queryKey: ['events', user.id],
      queryFn: () => api.events.getEvents(user.id),
    });
    return;
  }

  if (base === '/assignments' || base.startsWith('/assignments/')) {
    void queryClient.prefetchQuery({
      queryKey: ['assignments', user.id, user.role],
      queryFn: () => api.assignments.getAssignments({ requesterId: user.id }),
    });
    return;
  }

  if (base === '/notifications' || base.startsWith('/notifications/')) {
    void queryClient.prefetchQuery({
      queryKey: ['notifications', user.id],
      queryFn: () => api.notifications.getNotifications(user.id),
    });
  }
}
