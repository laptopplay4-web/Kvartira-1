import type { ApiClient } from '@/services/api/types';
import { pocketbaseAuthApi } from '@/services/api/pocketbase/auth';
import { pocketbaseUsersApi } from '@/services/api/pocketbase/users';
import { pocketbaseLessonsApi } from '@/services/api/pocketbase/lessons';
import { pocketbaseAvailabilityApi } from '@/services/api/pocketbase/availability';
import { pocketbaseEventsApi } from '@/services/api/pocketbase/events';
import { pocketbaseChatApi } from '@/services/api/pocketbase/chat';
import { pocketbaseProgressApi } from '@/services/api/pocketbase/progress';
import { pocketbaseSupportApi } from '@/services/api/pocketbase/support';
import { pocketbaseLegalApi } from '@/services/api/pocketbase/legal';
import { pocketbaseSecurityApi } from '@/services/api/pocketbase/security';
import { pocketbaseNotificationsApi } from '@/services/api/pocketbase/notifications';
import { pocketbaseSchoolSettingsApi } from '@/services/api/pocketbase/schoolSettings';
import { mockPublicApi, createPocketbaseHybridAssignmentApis } from '@/services/api/mock';

/**
 * PocketBase adapter (ROADMAP 2.1+).
 * Auth + Users + Lessons + Availability + Events + Chat + Progress + Support + Legal + Security + Notifications + SchoolSettings → PocketBase;
 * Assignments + Groups — mock hybrid (PB user ids → mock seed by phone);
 * public — mock.
 */
export function createPocketbaseApiClient(): ApiClient {
  const hybridAssignments = createPocketbaseHybridAssignmentApis();
  return {
    auth: pocketbaseAuthApi,
    users: pocketbaseUsersApi,
    lessons: pocketbaseLessonsApi,
    chat: pocketbaseChatApi,
    events: pocketbaseEventsApi,
    notifications: pocketbaseNotificationsApi,
    availability: pocketbaseAvailabilityApi,
    assignments: hybridAssignments.assignments,
    assignmentGroups: hybridAssignments.assignmentGroups,
    progress: pocketbaseProgressApi,
    support: pocketbaseSupportApi,
    legal: pocketbaseLegalApi,
    public: mockPublicApi,
    security: pocketbaseSecurityApi,
    schoolSettings: pocketbaseSchoolSettingsApi,
  };
}
