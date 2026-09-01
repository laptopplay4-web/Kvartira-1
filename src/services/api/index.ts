import type { ApiClient } from '@/services/api/types';
import {
  mockAuthApi,
  mockAvailabilityApi,
  mockChatApi,
  mockEventsApi,
  mockLessonsApi,
  mockNotificationsApi,
  mockUsersApi,
  mockAssignmentsApi,
  mockProgressApi,
  mockSupportApi,
  mockPublicApi,
  mockSecurityApi,
  mockLegalApi,
  mockSchoolSettingsApi,
} from '@/services/api/mock';
import { createPocketbaseApiClient } from '@/services/api/pocketbase';

export function createApiClient(): ApiClient {
  const mode = import.meta.env.VITE_API_MODE ?? 'mock';

  if (mode === 'mock') {
    return {
      auth: mockAuthApi,
      lessons: mockLessonsApi,
      chat: mockChatApi,
      events: mockEventsApi,
      users: mockUsersApi,
      notifications: mockNotificationsApi,
      availability: mockAvailabilityApi,
      assignments: mockAssignmentsApi,
      progress: mockProgressApi,
      support: mockSupportApi,
      public: mockPublicApi,
      security: mockSecurityApi,
      legal: mockLegalApi,
      schoolSettings: mockSchoolSettingsApi,
    };
  }

  if (mode === 'pocketbase') {
    return createPocketbaseApiClient();
  }

  throw new Error(`Unsupported API mode: ${mode}`);
}

export const api = createApiClient();
