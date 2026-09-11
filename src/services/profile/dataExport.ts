import type { ApiClient, PersonalDataExport } from '@/services/api/types';

/**
 * Everything the app holds about one person, in one JSON file.
 *
 * 152-ФЗ ст. 14 gives the subject the right to receive their data; the practical
 * form is a download. Each source is read through the normal API, so the same
 * IDOR checks apply — a request can only ever export the requester's own data.
 *
 * Blocks that fail (a module unavailable, a network hiccup) come back empty
 * rather than failing the whole export: a partial file is more useful than none.
 */
export async function buildPersonalDataExport(
  api: ApiClient,
  requesterId: string,
): Promise<PersonalDataExport> {
  const soft = async <T>(load: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await load();
    } catch {
      return fallback;
    }
  };

  const [profile, consents, lessons, assignments, notifications, supportTickets, loginHistory] =
    await Promise.all([
      api.users.getUser(requesterId, requesterId),
      soft(() => api.legal.getUserConsents(requesterId), []),
      soft(() => api.lessons.getLessons({ requesterId }), []),
      soft(() => api.assignments.getAssignments({ requesterId }), []),
      soft(() => api.notifications.getNotifications(requesterId), []),
      soft(() => api.support.getTickets({ requesterId }), []),
      soft(() => api.security.getLoginHistory(requesterId), []),
    ]);

  return {
    exportedAt: new Date().toISOString(),
    profile,
    consents,
    lessons,
    assignments,
    notifications,
    supportTickets,
    loginHistory,
  };
}

export function personalDataExportFilename(now = new Date()): string {
  return `kvartira-my-data-${now.toISOString().slice(0, 10)}.json`;
}

export function downloadPersonalDataExport(
  data: PersonalDataExport,
  filename = personalDataExportFilename(),
): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
