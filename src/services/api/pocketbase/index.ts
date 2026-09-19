import type { ApiClient } from '@/services/api/types';
import { pocketbaseAuthApi } from '@/services/api/pocketbase/auth';
import { pocketbaseUsersApi } from '@/services/api/pocketbase/users';
import { pocketbaseLessonsApi } from '@/services/api/pocketbase/lessons';
import { pocketbaseAvailabilityApi } from '@/services/api/pocketbase/availability';
import { pocketbaseEventsApi } from '@/services/api/pocketbase/events';
import { pocketbaseChatApi } from '@/services/api/pocketbase/chat';
import { pocketbaseAssignmentsApi } from '@/services/api/pocketbase/assignments';
import { pocketbaseAssignmentGroupsApi } from '@/services/api/pocketbase/groups';
import { pocketbaseSupportApi } from '@/services/api/pocketbase/support';
import { pocketbaseLegalApi } from '@/services/api/pocketbase/legal';
import { pocketbaseSecurityApi } from '@/services/api/pocketbase/security';
import { pocketbaseNotificationsApi } from '@/services/api/pocketbase/notifications';
import { pocketbaseSchoolSettingsApi } from '@/services/api/pocketbase/schoolSettings';
import { pocketbasePublicApi } from '@/services/api/pocketbase/public';
import { createYclientsLessonsApi } from '@/services/api/pocketbase/yclientsLessons';
import { getYclientsApi } from '@/services/api/yclientsClient';
import { isYclientsLessonsEnabled } from '@/config/features';

// Re-export for callers that imported pocketbase path directly
export { getYclientsApi };

/**
 * PocketBase adapter — all core modules including assignments/groups and public landing.
 * Optional: VITE_LESSONS_SOURCE=yclients → LessonsApi via YCLIENTS BFF.
 */
export function createPocketbaseApiClient(): ApiClient {
  const lessons = isYclientsLessonsEnabled()
    ? createYclientsLessonsApi(pocketbaseLessonsApi)
    : pocketbaseLessonsApi;

  return {
    auth: pocketbaseAuthApi,
    users: pocketbaseUsersApi,
    lessons,
    chat: pocketbaseChatApi,
    events: pocketbaseEventsApi,
    notifications: pocketbaseNotificationsApi,
    availability: pocketbaseAvailabilityApi,
    assignments: pocketbaseAssignmentsApi,
    assignmentGroups: pocketbaseAssignmentGroupsApi,
    support: pocketbaseSupportApi,
    legal: pocketbaseLegalApi,
    public: pocketbasePublicApi,
    security: pocketbaseSecurityApi,
    schoolSettings: pocketbaseSchoolSettingsApi,
  };
}
