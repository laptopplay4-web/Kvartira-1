import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ClientResponseError } from 'pocketbase';
import { ApiError } from '@/services/api/types';
import {
  mapDirectionRecord,
  mapAvailabilityRecord,
  mapLessonHistoryRecord,
  mapLessonRecord,
  mapEventRecord,
  mapEventRegistrationRecord,
  mapConversationRecord,
  mapConversationMemberRecord,
  mapMessageRecord,
  mapAssignmentRecord,
  mapAssignmentGroupRecord,
  mapPublicNewsRecord,
  mapHelpArticleRecord,
  mapSupportTicketRecord,
  mapLegalDocumentRecord,
  mapUserConsentRecord,
  mapSecuritySessionRecord,
  mapLoginHistoryRecord,
  mapSecurityAlertRecord,
  mapNotificationRecord,
  mapNotificationPreferencesRecord,
  mapSchoolSettingsRecord,
  mapUserRecord,
  userToPbRecord,
} from '@/services/api/pocketbase/mappers';
import { escapePbFilter, normalizePbDate, normalizePbDateTime, pbEqOr, relId } from '@/services/api/pocketbase/helpers';
import { mapPocketBaseError } from '@/services/api/pocketbase/errors';
import { createApiClient } from '@/services/api/index';
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

const ROOT = resolve(import.meta.dirname, '../..');

describe('PocketBase adapter (ROADMAP 2.1–2.10)', () => {
  it('adapter files exist and register pocketbase mode', () => {
    const indexSource = readFileSync(
      resolve(ROOT, 'src/services/api/index.ts'),
      'utf8',
    );
    expect(indexSource).toContain('createPocketbaseApiClient');
    expect(indexSource).toContain("mode === 'pocketbase'");

    const files = [
      'src/services/api/pocketbase/client.ts',
      'src/services/api/pocketbase/auth.ts',
      'src/services/api/pocketbase/users.ts',
      'src/services/api/pocketbase/lessons.ts',
      'src/services/api/pocketbase/availability.ts',
      'src/services/api/pocketbase/events.ts',
      'src/services/api/pocketbase/chat.ts',
      'src/services/api/pocketbase/assignments.ts',
      'src/services/api/pocketbase/groups.ts',
      'src/services/api/pocketbase/public.ts',
      'src/services/api/pocketbase/support.ts',
      'src/services/api/pocketbase/legal.ts',
      'src/services/api/pocketbase/security.ts',
      'src/services/api/pocketbase/notifications.ts',
      'src/services/api/pocketbase/files.ts',
      'src/services/api/pocketbase/mappers.ts',
      'src/services/api/pocketbase/errors.ts',
      'src/services/api/pocketbase/index.ts',
    ];
    for (const file of files) {
      expect(readFileSync(resolve(ROOT, file), 'utf8').length).toBeGreaterThan(0);
    }
  });

  it('lessons adapter migration adds directionIds, planningPeriod, lesson_history access', () => {
    const source = readFileSync(
      resolve(ROOT, 'pocketbase/pb_migrations/1788499200_kvartira_lessons_adapter.js'),
      'utf8',
    );
    expect(source).toContain('directionIds');
    expect(source).toContain('planningPeriod');
    expect(source).toContain('@collection.lessons.id ?= lesson');
  });

  it('users auth-read migration widens list/view for authenticated users', () => {
    const source = readFileSync(
      resolve(ROOT, 'pocketbase/pb_migrations/1788412800_kvartira_users_auth_read.js'),
      'utf8',
    );
    expect(source).toContain('users.listRule');
    expect(source).toContain('@request.auth.id != ""');
  });

  it('mapUserRecord maps PB record to User', () => {
    const user = mapUserRecord({
      id: 'rec1',
      collectionId: 'users',
      collectionName: 'users',
      created: '',
      updated: '',
      phone: '+79001234567',
      role: 'student',
      firstName: 'Анна',
      lastName: 'Иванова',
      avatarUrl: 'https://example.com/a.png',
      bio: 'bio',
    });

    expect(user).toEqual({
      id: 'rec1',
      phone: '+79001234567',
      role: 'student',
      firstName: 'Анна',
      lastName: 'Иванова',
      avatarUrl: 'https://example.com/a.png',
      bio: 'bio',
    });
  });

  it('mapUserRecord parses directionIds JSON string from PB', () => {
    const user = mapUserRecord({
      id: 'rec2',
      collectionId: 'users',
      collectionName: 'users',
      created: '',
      updated: '',
      phone: '+79001234567',
      role: 'teacher',
      firstName: 'Елена',
      lastName: 'Волкова',
      directionIds: '["abc","def"]',
    } as Parameters<typeof mapUserRecord>[0]);
    expect(user.directionIds).toEqual(['abc', 'def']);
  });

  it('mapUserRecord defaults missing phone to empty string', () => {
    const user = mapUserRecord({
      id: 'rec-no-phone',
      collectionId: 'users',
      collectionName: 'users',
      created: '',
      updated: '',
      role: 'student',
      firstName: 'Анна',
      lastName: 'Иванова',
    } as Parameters<typeof mapUserRecord>[0]);

    expect(user.phone).toBe('');
  });

  it('mapUserRecord recovers phone from synthetic email only for own record', () => {
    const record = {
      id: 'rec-email-phone',
      collectionId: 'users',
      collectionName: 'users',
      created: '',
      updated: '',
      role: 'student',
      firstName: 'Анна',
      lastName: 'Иванова',
      email: '79001234567@kvartira.local',
    } as Parameters<typeof mapUserRecord>[0];

    expect(mapUserRecord(record, { ownRecord: true }).phone).toBe('+79001234567');
    // Another user's record: synthetic email must never be decoded back to a phone.
    expect(mapUserRecord(record).phone).toBe('');
  });

  it('users hook hides email together with phone (synthetic email leaks the phone)', () => {
    const hook = readFileSync(resolve(ROOT, 'pocketbase/pb_hooks/users.pb.js'), 'utf8');
    expect(hook).toContain("hide('phone', 'email', 'avatarOriginalUrl')");
    expect(hook).not.toMatch(/hide\.apply\s*\(/);
    // Superuser Admin UI must not hit hide (otherwise enrich fails / fields vanish).
    expect(hook).toContain('isUsersAuth');
    expect(hook).toContain('joinAdminToAllGroupChats');
    expect(hook).toContain('joinUserToSchoolWideChats');
    expect(hook).toContain('onRecordAfterUpdateSuccess');
  });

  it('userToPbRecord round-trips through mapUserRecord', () => {
    const original = {
      id: 'rec2',
      phone: '+79007654321',
      role: 'teacher' as const,
      firstName: 'Пётр',
      lastName: 'Смирнов',
      avatarUrl: 'data:image/png;base64,abc',
    };
    const mapped = mapUserRecord(userToPbRecord(original));
    expect(mapped.id).toBe(original.id);
    expect(mapped.phone).toBe(original.phone);
    expect(mapped.avatarUrl).toBe(original.avatarUrl);
  });

  it('mapLessonRecord maps relations and dates', () => {
    const lesson = mapLessonRecord({
      id: 'lesson-1',
      collectionId: 'lessons',
      collectionName: 'lessons',
      created: '2026-08-01T10:00:00.000Z',
      updated: '2026-08-02T10:00:00.000Z',
      student: 'student-1',
      teacher: 'teacher-1',
      direction: 'dir-vocal',
      date: '2026-09-15 00:00:00.000Z',
      startTime: '14:00',
      durationMinutes: 60,
      status: 'scheduled',
      location: 'Студия',
      materials: [{ id: 'm1', filename: 'a.pdf', mimeType: 'application/pdf', url: '/a.pdf' }],
      teacherNotes: 'note',
      cancelReason: '',
    });

    expect(lesson).toMatchObject({
      id: 'lesson-1',
      studentId: 'student-1',
      teacherId: 'teacher-1',
      directionId: 'dir-vocal',
      date: '2026-09-15',
      startTime: '14:00',
      durationMinutes: 60,
      status: 'scheduled',
      location: 'Студия',
      teacherNotes: 'note',
    });
    expect(lesson.materials).toHaveLength(1);
    expect(lesson.cancelReason).toBeUndefined();
  });

  it('mapLessonRecord maps yclients external fields', () => {
    const lesson = mapLessonRecord({
      id: 'lesson-ext',
      collectionId: 'lessons',
      collectionName: 'lessons',
      created: '2026-08-01T10:00:00.000Z',
      updated: '2026-08-02T10:00:00.000Z',
      student: 'student-1',
      teacher: 'teacher-1',
      direction: 'dir-vocal',
      date: '2026-09-15 00:00:00.000Z',
      startTime: '14:00',
      durationMinutes: 60,
      status: 'scheduled',
      externalSource: 'yclients',
      externalId: 'yc-555',
    });
    expect(lesson.externalSource).toBe('yclients');
    expect(lesson.externalId).toBe('yc-555');
  });

  it('mapDirectionRecord and mapAvailabilityRecord map PB fields', () => {
    const direction = mapDirectionRecord({
      id: 'dir-1',
      collectionId: 'directions',
      collectionName: 'directions',
      created: '',
      updated: '',
      name: 'Вокал',
      description: 'desc',
      icon: '🎤',
    });
    expect(direction).toEqual({
      id: 'dir-1',
      name: 'Вокал',
      description: 'desc',
      icon: '🎤',
    });

    const availability = mapAvailabilityRecord({
      id: 'avail-1',
      collectionId: 'teacher_availability',
      collectionName: 'teacher_availability',
      created: '',
      updated: '',
      teacher: 'teacher-1',
      slotIntervalMinutes: 30,
      defaultLessonDurationMinutes: 60,
      schedule: [{ dayOfWeek: 1, ranges: [{ start: '10:00', end: '18:00' }] }],
      exceptions: [{ date: '2026-09-01', off: true }],
      planningPeriod: { startDate: '2026-09-01', endDate: '2026-09-30' },
    });

    expect(availability.teacherId).toBe('teacher-1');
    expect(availability.planningPeriod).toEqual({
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    });
  });

  it('mapLessonHistoryRecord maps history entry', () => {
    const entry = mapLessonHistoryRecord({
      id: 'hist-1',
      collectionId: 'lesson_history',
      collectionName: 'lesson_history',
      created: '2026-08-01T12:00:00.000Z',
      updated: '',
      lesson: 'lesson-1',
      action: 'rescheduled',
      previousDate: '2026-09-10 00:00:00.000Z',
      previousStartTime: '10:00',
      newDate: '2026-09-11 00:00:00.000Z',
      newStartTime: '11:00',
      reason: '',
      user: 'user-1',
    });

    expect(entry).toEqual({
      id: 'hist-1',
      lessonId: 'lesson-1',
      action: 'rescheduled',
      previousDate: '2026-09-10',
      previousStartTime: '10:00',
      newDate: '2026-09-11',
      newStartTime: '11:00',
      userId: 'user-1',
      createdAt: '2026-08-01T12:00:00.000Z',
    });
  });

  it('relId and normalizePbDate helpers', () => {
    expect(relId('abc')).toBe('abc');
    expect(relId({ id: 'expanded' })).toBe('expanded');
    expect(normalizePbDate('2026-09-15 00:00:00.000Z')).toBe('2026-09-15');
  });

  it('mapPocketBaseError maps invalid credentials to Russian message', () => {
    const pbError = new ClientResponseError({
      status: 400,
      response: { message: 'Invalid login credentials.' },
    } as never);
    const apiError = mapPocketBaseError(pbError);
    expect(apiError).toBeInstanceOf(ApiError);
    expect(apiError.message).toBe('Неверный телефон или пароль');
    expect(apiError.code).toBe('INVALID_CREDENTIALS');
  });

  it('mapPocketBaseError maps generic hook failure to Russian message', () => {
    const pbError = new ClientResponseError({
      status: 400,
      response: { message: 'Something went wrong while processing your request.' },
    } as never);
    const apiError = mapPocketBaseError(pbError);
    expect(apiError.message).toContain('Не удалось выполнить запрос');
    expect(apiError.message).not.toContain('войти');
    expect(apiError.code).toBe('SERVER_ERROR');
  });

  it('mapPocketBaseError maps unique slot conflict to SLOT_CONFLICT', () => {
    const pbError = new ClientResponseError({
      status: 409,
      response: { message: 'UNIQUE constraint failed: idx_lessons_teacher_slot' },
    } as never);
    const apiError = mapPocketBaseError(pbError);
    expect(apiError.code).toBe('SLOT_CONFLICT');
    expect(apiError.message).toContain('занят');
  });

  it('mapPocketBaseError maps event full to FULL and other unique to DUPLICATE', () => {
    const fullError = new ClientResponseError({
      status: 409,
      response: { message: 'Мест больше нет' },
    } as never);
    expect(mapPocketBaseError(fullError).code).toBe('FULL');

    const uniqueReg = new ClientResponseError({
      status: 409,
      response: { message: 'UNIQUE constraint failed: idx_event_registration' },
    } as never);
    expect(mapPocketBaseError(uniqueReg).code).toBe('DUPLICATE');
  });

  it('createApiClient uses pocketbase modules when VITE_API_MODE=pocketbase', () => {
    vi.stubEnv('VITE_API_MODE', 'pocketbase');
    const client = createApiClient();
    expect(client.auth.login).toBeTypeOf('function');
    expect(client.users.getAllUsers).toBeTypeOf('function');
    expect(client.users.updateUserRole).toBeTypeOf('function');
    expect(client.lessons.getDirections).toBe(pocketbaseLessonsApi.getDirections);
    expect(client.lessons.createDirection).toBe(pocketbaseLessonsApi.createDirection);
    expect(client.lessons.updateDirection).toBe(pocketbaseLessonsApi.updateDirection);
    expect(client.lessons.deleteDirection).toBe(pocketbaseLessonsApi.deleteDirection);
    expect(client.availability.getTeacherAvailability).toBe(
      pocketbaseAvailabilityApi.getTeacherAvailability,
    );
    expect(client.events.getEvents).toBe(pocketbaseEventsApi.getEvents);
    expect(client.chat.getConversations).toBe(pocketbaseChatApi.getConversations);
    expect(client.assignments.getAssignments).toBe(pocketbaseAssignmentsApi.getAssignments);
    expect(client.assignments.updateAssignment).toBe(pocketbaseAssignmentsApi.updateAssignment);
    expect(client.assignments.deleteAssignment).toBe(pocketbaseAssignmentsApi.deleteAssignment);
    expect(client.assignmentGroups.getGroups).toBe(pocketbaseAssignmentGroupsApi.getGroups);
    expect(client.public.getLandingData).toBe(pocketbasePublicApi.getLandingData);
    expect(client.support.getTickets).toBe(pocketbaseSupportApi.getTickets);
    expect(client.legal.getDocuments).toBe(pocketbaseLegalApi.getDocuments);
    expect(client.security.getOverview).toBe(pocketbaseSecurityApi.getOverview);
    expect(client.notifications.getNotifications).toBe(pocketbaseNotificationsApi.getNotifications);
    expect(client.schoolSettings.getSchoolSettings).toBe(
      pocketbaseSchoolSettingsApi.getSchoolSettings,
    );
    vi.unstubAllEnvs();
  });

  it('mapEventRecord maps relations, dates and optional fields', () => {
    const event = mapEventRecord({
      id: 'event-1',
      collectionId: 'events',
      collectionName: 'events',
      created: '',
      updated: '',
      title: 'Концерт',
      description: 'Вечер',
      type: 'concert',
      date: '2026-12-20 00:00:00.000Z',
      startTime: '18:00',
      endTime: '20:00',
      location: 'Зал',
      imageUrl: 'https://example.com/e.jpg',
      maxParticipants: 50,
      registeredUserIds: ['user-1'],
      invitedUserIds: [],
    });

    expect(event).toMatchObject({
      id: 'event-1',
      title: 'Концерт',
      type: 'concert',
      date: '2026-12-20',
      startTime: '18:00',
      endTime: '20:00',
      location: 'Зал',
      imageUrl: 'https://example.com/e.jpg',
      maxParticipants: 50,
      registeredCount: 1,
      registeredUserIds: ['user-1'],
    });
    expect(event.invitedUserIds).toBeUndefined();
  });

  it('mapEventRecord prefers registeredCount field over roster length', () => {
    const event = mapEventRecord({
      id: 'event-2',
      collectionId: 'events',
      collectionName: 'events',
      created: '',
      updated: '',
      title: 'МК',
      description: 'Джаз',
      type: 'masterclass',
      date: '2026-12-01',
      startTime: '15:00',
      location: 'Студия',
      maxParticipants: 12,
      registeredCount: 1,
      registeredUserIds: ['user-1', 'hidden', 'hidden'],
    } as Parameters<typeof mapEventRecord>[0]);
    expect(event.registeredCount).toBe(1);
  });

  it('mapEventRegistrationRecord maps event, user and application', () => {
    const registration = mapEventRegistrationRecord({
      id: 'reg-1',
      collectionId: 'event_registrations',
      collectionName: 'event_registrations',
      created: '2026-08-01T12:00:00.000Z',
      updated: '',
      event: 'event-3',
      user: 'user-student',
      application: {
        pieceTitle: 'Калинка',
        composer: 'Народная',
        durationMinutes: 3,
      },
    });

    expect(registration).toEqual({
      id: 'reg-1',
      eventId: 'event-3',
      userId: 'user-student',
      createdAt: '2026-08-01T12:00:00.000Z',
      application: {
        pieceTitle: 'Калинка',
        composer: 'Народная',
        durationMinutes: 3,
      },
    });
  });

  it('events hook syncs registeredUserIds and checks capacity', () => {
    const hook = readFileSync(resolve(ROOT, 'pocketbase/pb_hooks/events.pb.js'), 'utf8');
    const lib = readFileSync(
      resolve(ROOT, 'pocketbase/pb_hooks/lib/kvartiraEvents.js'),
      'utf8',
    );

    expect(hook).toContain('onRecordCreateRequest');
    expect(hook).toContain('onRecordAfterCreateSuccess');
    expect(hook).toContain('onRecordAfterDeleteSuccess');
    expect(hook).toContain('event_registrations');
    expect(hook).toContain('registeredCount');
    expect(hook).toContain('notifyStaffEventRegistration');
    expect(hook).toContain('notifyStaffEventUnregistration');
    expect(hook).toContain('stashUnregistrationNotify');
    expect(hook).toContain('takeUnregistrationNotify');
    expect(hook).toContain('purgeEventDependents');
    expect(hook).toContain('onRecordDeleteRequest');
    expect(lib).toContain('assertRegistrationCapacity');
    expect(lib).toContain('assertRegistrationCreate');
    expect(lib).toContain('syncRegisteredUserIds');
    expect(lib).toContain('notifyStaffEventRegistration');
    expect(lib).toContain('notifyStaffEventUnregistration');
    expect(lib).toContain('stashUnregistrationNotify');
    expect(lib).toContain('c=leave');
    expect(lib).toContain('notifyStudentsNewEvent');
    expect(lib).toContain('purgeEventDependents');
    expect(lib).toContain('registeredCount');
    expect(lib).toContain('Мест больше нет');

    const adapter = readFileSync(
      resolve(ROOT, 'src/services/api/pocketbase/events.ts'),
      'utf8',
    );
    expect(adapter).toContain('notifyStudentsNewEventFromClient');
    expect(adapter).toContain('removeEventParticipant');
    expect(adapter).toContain('event_registrations');
  });

  it('lessons hooks lock participant fields and hide teacherNotes from students', () => {
    const hook = readFileSync(resolve(ROOT, 'pocketbase/pb_hooks/lessons.pb.js'), 'utf8');
    const lib = readFileSync(
      resolve(ROOT, 'pocketbase/pb_hooks/lib/kvartiraLessons.js'),
      'utf8',
    );

    expect(hook).toContain('onRecordEnrich');
    expect(hook).toContain("hide('teacherNotes')");
    expect(hook).toContain('assertLessonCreate');
    expect(hook).toContain('assertLessonUpdate');

    expect(lib).toContain('STUDENT_LOCKED_FIELDS');
    expect(lib).toContain('TEACHER_LOCKED_FIELDS');
    // A student must never be able to rewrite notes or swap participants.
    expect(lib).toContain("'teacherNotes'");
    expect(lib).toContain("'teacher'");
    expect(lib).toContain('STUDENT_ALLOWED_STATUSES');
  });

  it('chat adapter migration lets conversation owner/admin remove members', () => {
    const source = readFileSync(
      resolve(ROOT, 'pocketbase/pb_migrations/1788585600_kvartira_chat_adapter.js'),
      'utf8',
    );
    expect(source).toContain('conversation_members');
    expect(source).toContain('deleteRule');
    expect(source).toContain('role ?= "owner"');
    expect(source).toContain('role ?= "admin"');
  });

  it('mapConversationRecord maps participants, metadata and lastMessage', () => {
    const conv = mapConversationRecord({
      id: 'conv-1',
      collectionId: 'conversations',
      collectionName: 'conversations',
      created: '2026-08-01 10:00:00.000Z',
      updated: '2026-08-02 11:00:00.000Z',
      type: 'personal',
      title: 'Анна',
      participantIds: ['user-1', 'user-2'],
      lastMessageAt: '2026-08-02 11:00:00.000Z',
      lastMessage: {
        id: 'msg-1',
        text: 'Привет',
        senderId: 'user-1',
        createdAt: '2026-08-02 11:00:00.000Z',
      },
      metadata: { lessonId: 'lesson-1' },
      pinnedMessageIds: ['msg-1'],
    });

    expect(conv).toMatchObject({
      id: 'conv-1',
      type: 'personal',
      title: 'Анна',
      participantIds: ['user-1', 'user-2'],
      metadata: { lessonId: 'lesson-1' },
      pinnedMessageIds: ['msg-1'],
    });
    expect(conv.lastMessage?.text).toBe('Привет');
    expect(conv.createdAt).toBe('2026-08-01T10:00:00.000Z');
  });

  it('mapConversationMemberRecord and mapMessageRecord map relations and dates', () => {
    const member = mapConversationMemberRecord({
      id: 'cm-1',
      collectionId: 'conversation_members',
      collectionName: 'conversation_members',
      created: '2026-08-01T10:00:00.000Z',
      updated: '',
      conversation: 'conv-1',
      user: 'user-student',
      role: 'owner',
      lastReadMessageId: 'msg-1',
      lastReadAt: '2026-08-01 12:00:00.000Z',
      muted: false,
    });

    expect(member).toMatchObject({
      conversationId: 'conv-1',
      userId: 'user-student',
      role: 'owner',
      lastReadMessageId: 'msg-1',
      muted: false,
    });
    expect(member.lastReadAt).toBe('2026-08-01T12:00:00.000Z');

    const message = mapMessageRecord({
      id: 'msg-1',
      collectionId: 'messages',
      collectionName: 'messages',
      created: '2026-08-01 12:00:00.000Z',
      updated: '2026-08-01 12:05:00.000Z',
      conversation: 'conv-1',
      sender: 'user-student',
      text: 'Привет',
      status: 'sent',
      readBy: ['user-student'],
      messageType: 'user',
      clientMutationId: 'c1',
    });

    expect(message).toMatchObject({
      id: 'msg-1',
      conversationId: 'conv-1',
      senderId: 'user-student',
      text: 'Привет',
      status: 'sent',
      clientMutationId: 'c1',
    });
    expect(message.createdAt).toBe('2026-08-01T12:00:00.000Z');
  });

  it('getPbRecordCreatedAt and getPbRecordUpdatedAt fall back when autodate missing', async () => {
    const { getPbRecordCreatedAt, getPbRecordUpdatedAt } = await import(
      '@/services/api/pocketbase/helpers'
    );
    expect(getPbRecordCreatedAt({}, '2026-08-02 09:00:00.000Z')).toBe('2026-08-02T09:00:00.000Z');
    expect(getPbRecordUpdatedAt({ created: '2026-08-01 10:00:00.000Z' }, undefined)).toBe(
      '2026-08-01T10:00:00.000Z',
    );
    expect(getPbRecordUpdatedAt({}, '2026-08-03T12:00:00.000Z')).toBe('2026-08-03T12:00:00.000Z');
  });

  it('mapMessageRecord falls back to editedAt when created is missing', () => {
    const message = mapMessageRecord({
      id: 'msg-2',
      collectionId: 'messages',
      collectionName: 'messages',
      conversation: 'conv-1',
      sender: 'user-student',
      text: 'Без created',
      status: 'sent',
      readBy: [],
      editedAt: '2026-08-02 09:30:00.000Z',
    });
    expect(message.createdAt).toBe('2026-08-02T09:30:00.000Z');
  });

  it('escapePbFilter and pbEqOr build safe filters', () => {
    expect(escapePbFilter('a"b\\c')).toBe('a\\"b\\\\c');
    expect(pbEqOr('conversation', ['c1', 'c2'])).toBe(
      'conversation = "c1" || conversation = "c2"',
    );
    expect(pbEqOr('conversation', [])).toBe('');
    expect(normalizePbDateTime('2026-08-01 12:00:00.000Z')).toBe('2026-08-01T12:00:00.000Z');
  });

  it('chat hooks sync lastMessage and read receipts', () => {
    const hook = readFileSync(resolve(ROOT, 'pocketbase/pb_hooks/chat.pb.js'), 'utf8');
    const lib = readFileSync(resolve(ROOT, 'pocketbase/pb_hooks/lib/kvartiraChat.js'), 'utf8');

    expect(hook).toContain('onRecordCreateRequest');
    expect(hook).toContain('onRecordAfterCreateSuccess');
    expect(hook).toContain('onRecordAfterUpdateSuccess');
    expect(hook).toContain('messages');
    expect(hook).toContain('conversation_members');
    expect(hook).toContain('assertConversationPinUpdate');
    expect(hook).toContain('joinAdminsToGroupConversation');
    expect(lib).toContain('syncConversationLastMessage');
    expect(lib).toContain('previewTextFromMessage');
    expect(lib).toContain('attachmentsPreviewLabel');
    expect(lib).toMatch(/findRecordsByFilter\(\s*'messages'[\s\S]*?'-created'/);
    expect(lib).toContain('syncReadReceipts');
    expect(lib).toContain('assertConversationPinUpdate');
    expect(lib).toContain('joinAdminsToGroupConversation');
    expect(lib).toContain('joinAllUsersToSchoolWideConversation');
    expect(lib).toContain('joinAdminToAllGroupChats');
    expect(hook).toContain('joinAllUsersToSchoolWideConversation');
  });

  it('chat list loads unread candidates instead of full message history', () => {
    const chatApi = readFileSync(resolve(ROOT, 'src/services/api/pocketbase/chat.ts'), 'utf8');
    expect(chatApi).toContain('buildUnreadCandidateFilter');
    expect(chatApi).toContain('loadUnreadCandidateMessages');
    expect(chatApi).toContain('loadMessagesForConversationEnrichment');
    expect(chatApi).not.toMatch(/async function loadMessagesForConversations\(/);
    expect(chatApi).toContain('addMembers(');
    expect(chatApi).not.toContain('ensureSchoolWideMembershipPb');
    expect(chatApi).not.toContain('ensureAdminGroupMembershipPb');
  });

  it('buildUnreadCandidateFilter scopes by lastReadAt and excludes own/system', async () => {
    const { buildUnreadCandidateFilter } = await import('@/services/api/pocketbase/chat');
    const filter = buildUnreadCandidateFilter(
      ['c1', 'c2'],
      'user-1',
      [
        {
          conversationId: 'c1',
          userId: 'user-1',
          role: 'member',
          joinedAt: '2026-01-01T00:00:00.000Z',
          muted: false,
          lastReadAt: '2026-01-01T12:00:00.000Z',
        },
        {
          conversationId: 'c2',
          userId: 'user-1',
          role: 'member',
          joinedAt: '2026-01-01T00:00:00.000Z',
          muted: false,
        },
      ],
    );
    expect(filter).toContain('conversation = "c1"');
    expect(filter).toContain('created > "2026-01-01T12:00:00.000Z"');
    expect(filter).toContain('conversation = "c2"');
    expect(filter).toContain('sender != "user-1"');
    expect(filter).toContain('messageType != "system"');
  });

  it('requester helper prefers authStore for self and getOne for others', () => {
    const requester = readFileSync(
      resolve(ROOT, 'src/services/api/pocketbase/requester.ts'),
      'utf8',
    );
    expect(requester).toContain('authStore.record');
    expect(requester).toContain('ownRecord: true');
    expect(requester).toContain("collection('users').getOne");

    const chatApi = readFileSync(resolve(ROOT, 'src/services/api/pocketbase/chat.ts'), 'utf8');
    expect(chatApi).toContain("from '@/services/api/pocketbase/requester'");
    expect(chatApi).not.toMatch(/async function getRequesterUser\(/);
  });

  it('mapAssignmentRecord maps group, dates and content blocks', () => {
    const assignment = mapAssignmentRecord({
      id: 'asgn-1',
      collectionId: 'assignments',
      collectionName: 'assignments',
      created: '2026-08-01 10:00:00.000Z',
      updated: '2026-08-02 11:00:00.000Z',
      title: 'Этюд №3',
      description: 'Отработайте 16 тактов',
      teacher: 'user-teacher-1',
      group: 'grp-vocalists',
      dueDate: '2026-09-05 00:00:00.000Z',
      contentBlocks: [
        { id: 'blk-1', type: 'text', order: 0, text: 'Текст' },
        { id: 'blk-2', type: 'pdf', order: 1, filename: 'notes.pdf', mimeType: 'application/pdf', url: '#' },
      ],
    });

    expect(assignment).toMatchObject({
      id: 'asgn-1',
      title: 'Этюд №3',
      teacherId: 'user-teacher-1',
      groupId: 'grp-vocalists',
      dueDate: '2026-09-05',
    });
    expect(assignment.contentBlocks).toHaveLength(2);
    expect(assignment.createdAt).toBe('2026-08-01T10:00:00.000Z');
  });

  it('mapAssignmentGroupRecord maps kind and members', () => {
    const group = mapAssignmentGroupRecord({
      id: 'grp-1',
      collectionId: 'assignment_groups',
      collectionName: 'assignment_groups',
      created: '2026-08-01 10:00:00.000Z',
      updated: '2026-08-01 10:00:00.000Z',
      name: 'Все ученики',
      teacher: 'user-teacher-1',
      kind: 'general',
      members: ['user-student', { id: 'user-student-2' }],
    });
    expect(group.isGeneral).toBe(true);
    expect(group.memberIds).toEqual(['user-student', 'user-student-2']);
    expect(group.teacherId).toBe('user-teacher-1');
  });

  it('mapPublicNewsRecord maps publishedAt date', () => {
    const news = mapPublicNewsRecord({
      id: 'news-1',
      collectionId: 'public_news',
      collectionName: 'public_news',
      created: '',
      updated: '',
      title: 'Новость',
      excerpt: 'Кратко',
      publishedAt: '2026-09-01 00:00:00.000Z',
    });
    expect(news).toMatchObject({ id: 'news-1', title: 'Новость', publishedAt: '2026-09-01' });
  });

  it('assignments groups migration adds collection and drops student field', () => {
    const migration = readFileSync(
      resolve(ROOT, 'pocketbase/pb_migrations/1789276800_kvartira_assignments_groups.js'),
      'utf8',
    );
    expect(migration).toContain('assignment_groups');
    expect(migration).toContain("kind");
    expect(migration).toContain('contentBlocks');
    expect(migration).toContain("role = \"teacher\"");
  });

  it('assignment hooks lock create teacher and group fields', () => {
    const hook = readFileSync(resolve(ROOT, 'pocketbase/pb_hooks/assignments.pb.js'), 'utf8');
    const lib = readFileSync(
      resolve(ROOT, 'pocketbase/pb_hooks/lib/kvartiraAssignments.js'),
      'utf8',
    );

    expect(hook).toContain('onRecordCreateRequest');
    expect(hook).toContain('onRecordAfterCreateSuccess');
    expect(hook).toContain('onRecordUpdateRequest');
    expect(hook).toContain('assignments');
    expect(hook).toContain('assignment_groups');
    expect(hook).toContain('notifyAssignmentCreated');
    expect(lib).toContain('assertAssignmentCreate');
    expect(lib).toContain('assertAssignmentUpdate');
    expect(lib).toContain('notifyAssignmentCreated');
    expect(lib).toContain('createNotificationForUser');
    expect(lib).toContain("'assignment'");
    expect(lib).toContain("role === 'teacher'");
    expect(lib).toContain("record.set('teacher', original.get('teacher'))");
    expect(lib).not.toContain('Assignments are immutable after create');
    expect(lib).toContain('assertAssignmentGroupCreate');
    expect(lib).toContain('Общая группа уже существует');
    expect(lib).toContain('assertAssignmentGroupDelete');
    expect(lib).toContain('purgeAssignmentsForGroup');
    expect(lib).toContain('Общую группу нельзя удалить');
    expect(lib).toContain('Укажите группу получателей');
  });

  it('pocketbase groups resolve sentinel grp-general to real general group', () => {
    const source = readFileSync(resolve(ROOT, 'src/services/api/pocketbase/groups.ts'), 'utf8');
    expect(source).toContain('ensureGeneralAssignmentGroup');
    expect(source).toContain('resolveAssignmentGroupIdForWrite');
    expect(source).toContain('isKindGeneralGroup');
    expect(source).toContain('reassignAssignmentsThenDelete');
    const assignments = readFileSync(
      resolve(ROOT, 'src/services/api/pocketbase/assignments.ts'),
      'utf8',
    );
    expect(assignments).toContain('resolveAssignmentGroupIdForWrite');
    expect(assignments).toContain('mapAssignmentRecord');
    expect(assignments).not.toContain("existing.get('teacher')");
  });

  it('mapHelpArticleRecord and mapSupportTicketRecord map relations and json fields', () => {
    const article = mapHelpArticleRecord({
      id: 'faq-1',
      collectionId: 'help_articles',
      collectionName: 'help_articles',
      created: '',
      updated: '',
      question: 'Как записаться?',
      answer: 'Через раздел Занятия',
      category: 'booking',
      keywords: ['запись', 'урок'],
    });
    expect(article).toMatchObject({
      id: 'faq-1',
      question: 'Как записаться?',
      category: 'booking',
      keywords: ['запись', 'урок'],
    });

    const ticket = mapSupportTicketRecord({
      id: 'ticket-1',
      collectionId: 'support_tickets',
      collectionName: 'support_tickets',
      created: '2026-08-01 10:00:00.000Z',
      updated: '2026-08-02 11:00:00.000Z',
      user: 'user-student',
      subject: 'Не открывается чат',
      message: 'После обновления приложения чат пустой',
      category: 'technical',
      status: 'answered',
      attachments: [{ id: 'a1', filename: 'screen.png', mimeType: 'image/png', url: '#' }],
      adminReply: {
        text: 'Попробуйте перезайти',
        authorId: 'user-admin',
        createdAt: '2026-08-02T11:00:00.000Z',
      },
    });
    expect(ticket).toMatchObject({
      userId: 'user-student',
      subject: 'Не открывается чат',
      status: 'answered',
    });
    expect(ticket.attachments).toHaveLength(1);
    expect(ticket.adminReply?.text).toBe('Попробуйте перезайти');
    expect(ticket.createdAt).toBe('2026-08-01T10:00:00.000Z');
  });

  it('mapSchoolSettingsRecord maps contacts json', () => {
    const settings = mapSchoolSettingsRecord({
      id: 'school-1',
      collectionId: 'school_settings',
      collectionName: 'school_settings',
      created: '',
      updated: '',
      name: 'Квартира',
      tagline: 'Школа музыки',
      about: 'Описание школы',
      contacts: {
        phone: '+7 (900) 123-45-67',
        email: 'hello@kvartira-music.ru',
        address: 'г. Москва',
        workingHours: 'Пн–Сб: 10:00–20:00',
        socialLinks: {
          vk: 'https://vk.com/kvartira',
          telegram: '',
          youtube: '',
          website: 'https://kvartira-music.ru',
          twoGis: '',
          yandexMaps: '',
        },
        directionsVideo: {
          url: 'pbfile:vid1',
          filename: 'route.mp4',
          mimeType: 'video/mp4',
          size: 1024,
        },
      },
    });

    expect(settings).toMatchObject({
      name: 'Квартира',
      tagline: 'Школа музыки',
      about: 'Описание школы',
      contacts: {
        phone: '+7 (900) 123-45-67',
        email: 'hello@kvartira-music.ru',
        address: 'г. Москва',
        workingHours: 'Пн–Сб: 10:00–20:00',
      },
      socialLinks: {
        vk: 'https://vk.com/kvartira',
        website: 'https://kvartira-music.ru',
      },
      directionsVideo: {
        url: 'pbfile:vid1',
        filename: 'route.mp4',
      },
    });
  });

  it('mapSchoolSettingsRecord reads nested extras from contacts json string', () => {
    const settings = mapSchoolSettingsRecord({
      id: 'school-2',
      collectionId: 'school_settings',
      collectionName: 'school_settings',
      created: '',
      updated: '',
      name: 'Квартира',
      tagline: 'Слоган',
      about: 'About',
      contacts: JSON.stringify({
        phone: '+7900',
        email: 'a@b.c',
        address: 'Адрес',
        workingHours: '10-20',
        socialLinks: { vk: 'vk.com/school', website: '' },
      }),
    });

    expect(settings.contacts.phone).toBe('+7900');
    expect(settings.socialLinks.vk).toBe('https://vk.com/school');
  });

  it('support hooks lock ticket create user and admin-only reply', () => {
    const hook = readFileSync(resolve(ROOT, 'pocketbase/pb_hooks/support.pb.js'), 'utf8');
    const lib = readFileSync(resolve(ROOT, 'pocketbase/pb_hooks/lib/kvartiraSupport.js'), 'utf8');
    const adapter = readFileSync(resolve(ROOT, 'src/services/api/pocketbase/support.ts'), 'utf8');

    expect(hook).toContain('support_tickets');
    expect(hook).toContain('onRecordCreateRequest');
    expect(hook).toContain('onRecordUpdateRequest');
    expect(lib).toContain('assertTicketCreate');
    expect(lib).toContain('assertTicketUpdate');
    expect(lib).toContain("status', 'open'");
    expect(adapter).toContain('notifyAdminsNewTicket');
    expect(adapter).toContain('adminHelpTicketPath');
    expect(adapter).toContain('urgent: true');
  });

  it('mapLegalDocumentRecord and mapUserConsentRecord map relations and json fields', () => {
    const document = mapLegalDocumentRecord({
      id: 'legal-privacy',
      collectionId: 'legal_documents',
      collectionName: 'legal_documents',
      created: '',
      updated: '',
      type: 'privacy_policy',
      title: 'Политика конфиденциальности',
      content: 'Текст политики конфиденциальности школы',
      currentVersion: '2.0',
      effectiveAt: '2026-01-15 00:00:00.000Z',
      requiresConsent: true,
      versionHistory: [
        { version: '2.0', effectiveAt: '2026-01-15', changeSummary: 'Обновление GDPR' },
      ],
    });
    expect(document).toMatchObject({
      id: 'legal-privacy',
      type: 'privacy_policy',
      currentVersion: '2.0',
      effectiveAt: '2026-01-15',
      requiresConsent: true,
    });
    expect(document.versionHistory).toHaveLength(1);

    const consent = mapUserConsentRecord({
      id: 'consent-1',
      collectionId: 'user_consents',
      collectionName: 'user_consents',
      created: '',
      updated: '',
      user: 'user-student',
      document: 'legal-privacy',
      documentType: 'privacy_policy',
      documentTitle: 'Политика конфиденциальности',
      version: '1.0',
      acceptedAt: '2026-01-10 12:00:00.000Z',
    });
    expect(consent).toMatchObject({
      userId: 'user-student',
      documentId: 'legal-privacy',
      documentType: 'privacy_policy',
      version: '1.0',
    });
    expect(consent.acceptedAt).toBe('2026-01-10T12:00:00.000Z');
  });

  it('legal hooks lock consent user and document type on update', () => {
    const hook = readFileSync(resolve(ROOT, 'pocketbase/pb_hooks/legal.pb.js'), 'utf8');
    const lib = readFileSync(resolve(ROOT, 'pocketbase/pb_hooks/lib/kvartiraLegal.js'), 'utf8');

    expect(hook).toContain('user_consents');
    expect(hook).toContain('legal_documents');
    expect(hook).toContain('onRecordCreateRequest');
    expect(hook).toContain('onRecordUpdateRequest');
    expect(lib).toContain('assertConsentCreate');
    expect(lib).toContain('assertLegalDocumentUpdate');
    expect(lib).toContain('requiresConsent');
    expect(lib).toContain("set('type'");
    expect(lib).toContain('isUsersAuth(auth)');
  });

  it('legal bootstrap hook + getDocuments sort avoid empty production register', () => {
    const hook = readFileSync(resolve(ROOT, 'pocketbase/pb_hooks/legal.pb.js'), 'utf8');
    const bootstrap = readFileSync(
      resolve(ROOT, 'pocketbase/pb_hooks/lib/kvartiraLegalBootstrap.js'),
      'utf8',
    );
    const adapter = readFileSync(resolve(ROOT, 'src/services/api/pocketbase/legal.ts'), 'utf8');

    expect(hook).toContain('onBootstrap');
    expect(hook).toContain('kvartiraLegalBootstrap');
    expect(bootstrap).toContain('ensureRequiredLegalDocuments');
    expect(bootstrap).toContain('privacy_policy');
    expect(adapter).toContain("sort: '-id'");
  });

  it('mapSecuritySessionRecord, mapLoginHistoryRecord and mapSecurityAlertRecord map relations', () => {
    const session = mapSecuritySessionRecord({
      id: 'sess-1',
      collectionId: 'security_sessions',
      collectionName: 'security_sessions',
      created: '2026-08-01 10:00:00.000Z',
      updated: '',
      user: 'user-student',
      deviceLabel: 'Chrome · Windows',
      platform: 'web',
      ipAddress: '192.168.1.10',
      lastActiveAt: '2026-08-31 12:00:00.000Z',
      isCurrent: true,
    });
    expect(session).toMatchObject({
      userId: 'user-student',
      deviceLabel: 'Chrome · Windows',
      isCurrent: true,
    });
    expect(session.lastActiveAt).toBe('2026-08-31T12:00:00.000Z');

    const history = mapLoginHistoryRecord({
      id: 'login-1',
      collectionId: 'login_history',
      collectionName: 'login_history',
      created: '2026-08-30 09:00:00.000Z',
      updated: '',
      user: 'user-student',
      deviceLabel: 'Chrome · Windows',
      ipAddress: '192.168.1.10',
      success: true,
    });
    expect(history).toMatchObject({
      userId: 'user-student',
      success: true,
    });
    expect(history.createdAt).toBe('2026-08-30T09:00:00.000Z');

    const alert = mapSecurityAlertRecord({
      id: 'alert-1',
      collectionId: 'security_alerts',
      collectionName: 'security_alerts',
      created: '2026-08-29 08:00:00.000Z',
      updated: '',
      user: 'user-student',
      type: 'failed_login',
      title: 'Неудачная попытка входа',
      message: 'Кто-то пытался войти',
      read: false,
    });
    expect(alert).toMatchObject({
      userId: 'user-student',
      type: 'failed_login',
      read: false,
    });
  });

  it('security hooks lock session user and alert fields on update', () => {
    const hook = readFileSync(resolve(ROOT, 'pocketbase/pb_hooks/security.pb.js'), 'utf8');
    const lib = readFileSync(resolve(ROOT, 'pocketbase/pb_hooks/lib/kvartiraSecurity.js'), 'utf8');
    const authHook = readFileSync(resolve(ROOT, 'pocketbase/pb_hooks/auth.pb.js'), 'utf8');
    const authLib = readFileSync(resolve(ROOT, 'pocketbase/pb_hooks/lib/kvartiraAuth.js'), 'utf8');
    const migration = readFileSync(
      resolve(ROOT, 'pocketbase/pb_migrations/1790668800_kvartira_security_session_fingerprint.js'),
      'utf8',
    );

    expect(hook).toContain('security_sessions');
    expect(hook).toContain('security_alerts');
    expect(hook).toContain('onRecordCreateRequest');
    expect(hook).toContain('onRecordUpdateRequest');
    expect(lib).toContain('assertSecuritySessionCreate');
    expect(lib).toContain('assertSecuritySessionUpdate');
    expect(lib).toContain('assertSecurityAlertUpdate');
    expect(lib).toContain('recordSecuritySession');
    expect(lib).toContain('markOnlyCurrentSession');
    expect(lib).toContain('tokenFingerprint');
    expect(lib).toContain('$security.sha256');
    expect(lib).not.toContain('deviceLabel = {:deviceLabel}');
    expect(authHook).toContain('recordSecuritySession');
    expect(authLib).toContain('detectBrowserName');
    expect(migration).toContain('tokenFingerprint');
  });

  it('mapNotificationRecord and mapNotificationPreferencesRecord map relations', () => {
    const notification = mapNotificationRecord({
      id: 'notif-1',
      collectionId: 'notifications',
      collectionName: 'notifications',
      created: '2026-08-31 12:00:00.000Z',
      updated: '',
      user: 'user-student',
      type: 'lesson',
      title: 'Занятие подтверждено',
      body: 'Завтра в 11:00',
      read: false,
      link: '/lessons/lesson-1',
    });
    expect(notification).toMatchObject({
      userId: 'user-student',
      type: 'lesson',
      read: false,
      link: '/lessons/lesson-1',
    });
    expect(notification.createdAt).toBe('2026-08-31T12:00:00.000Z');

    const prefs = mapNotificationPreferencesRecord({
      id: 'prefs-1',
      collectionId: 'notification_preferences',
      collectionName: 'notification_preferences',
      created: '',
      updated: '',
      user: 'user-student',
      pushEnabled: true,
    });
    expect(prefs).toEqual({ userId: 'user-student', pushEnabled: true });

    // Optional bool after 1791276800 — false/null must map to false (not blank crash).
    expect(
      mapNotificationPreferencesRecord({
        id: 'prefs-off',
        collectionId: 'notification_preferences',
        collectionName: 'notification_preferences',
        created: '',
        updated: '',
        user: 'user-student',
        pushEnabled: false,
      }).pushEnabled,
    ).toBe(false);
    expect(
      mapNotificationPreferencesRecord({
        id: 'prefs-null',
        collectionId: 'notification_preferences',
        collectionName: 'notification_preferences',
        created: '',
        updated: '',
        user: 'user-student',
        pushEnabled: undefined as unknown as boolean,
      }).pushEnabled,
    ).toBe(false);
  });

  it('notifications hooks lock content fields and preferences user on update', () => {
    const hook = readFileSync(resolve(ROOT, 'pocketbase/pb_hooks/notifications.pb.js'), 'utf8');
    const lib = readFileSync(resolve(ROOT, 'pocketbase/pb_hooks/lib/kvartiraNotifications.js'), 'utf8');
    const adapter = readFileSync(resolve(ROOT, 'src/services/api/pocketbase/notifications.ts'), 'utf8');

    expect(hook).toContain('notifications');
    expect(hook).toContain('notification_preferences');
    expect(hook).toContain('onRecordCreateRequest');
    expect(hook).toContain('onRecordUpdateRequest');
    expect(lib).toContain('assertNotificationCreate');
    expect(lib).toContain("type === 'event'");
    expect(lib).toContain('assertNotificationUpdate');
    expect(lib).toContain('assertNotificationPreferencesCreate');
    expect(lib).toContain('assertNotificationPreferencesUpdate');
    // Preferences update only locks `user`; does not clear pushEnabled.
    expect(lib).toContain("e.record.set('user'");
    expect(lib).not.toContain("set('pushEnabled'");
    expect(adapter).toContain('pushEnabled: updated.pushEnabled === true');
  });

  it('mapPocketBaseError maps invalid old password to INVALID_CREDENTIALS', () => {
    const pbError = new ClientResponseError({
      status: 400,
      response: { message: 'The provided old password is invalid.' },
    } as never);
    const apiError = mapPocketBaseError(pbError);
    expect(apiError.code).toBe('INVALID_CREDENTIALS');
    expect(apiError.message).toBe('Неверный текущий пароль');
  });

  it('files storage migration creates kvartira_files collection with RBAC', () => {
    const migration = readFileSync(
      resolve(ROOT, 'pocketbase/pb_migrations/1788758400_kvartira_files_storage.js'),
      'utf8',
    );
    expect(migration).toContain("'kvartira_files'");
    expect(migration).toContain("type: 'file'");
    expect(migration).toContain('conversation_members.conversation');
    expect(migration).toContain('assignments.id');
    expect(migration).toContain('support_tickets.id');
  });

  it('files hooks validate owner and lock immutable fields', () => {
    const hook = readFileSync(resolve(ROOT, 'pocketbase/pb_hooks/files.pb.js'), 'utf8');
    const lib = readFileSync(resolve(ROOT, 'pocketbase/pb_hooks/lib/kvartiraFiles.js'), 'utf8');

    expect(hook).toContain('kvartira_files');
    expect(hook).toContain('onRecordCreateRequest');
    expect(lib).toContain('assertFileCreate');
    expect(lib).toContain('assertFileUpdate');
    expect(lib).toContain("'avatar'");
    expect(lib).toContain('owner must match authenticated user');
  });

  it('file storage helpers parse pbfile refs and build data URLs', async () => {
    const {
      PB_FILE_URL_PREFIX,
      dataUrlToFile,
      isStoredFileRef,
      parseStoredFileRef,
      storedFileRef,
    } = await import('@/services/api/pocketbase/files');

    const ref = storedFileRef('file-abc');
    expect(ref).toBe(`${PB_FILE_URL_PREFIX}file-abc`);
    expect(isStoredFileRef(ref)).toBe(true);
    expect(parseStoredFileRef(ref)).toBe('file-abc');
    expect(parseStoredFileRef('https://example.com/a.png')).toBeNull();

    const file = dataUrlToFile('data:image/png;base64,AA==', 'test.png', 'image/png');
    expect(file.name).toBe('test.png');
    expect(file.type).toBe('image/png');
    expect(file.size).toBe(1);
  });

  it('users and groups adapters resolve avatars for other users', () => {
    const usersApi = readFileSync(resolve(ROOT, 'src/services/api/pocketbase/users.ts'), 'utf8');
    const groupsApi = readFileSync(resolve(ROOT, 'src/services/api/pocketbase/groups.ts'), 'utf8');
    const lessonsApi = readFileSync(resolve(ROOT, 'src/services/api/pocketbase/lessons.ts'), 'utf8');
    const publicApi = readFileSync(resolve(ROOT, 'src/services/api/pocketbase/public.ts'), 'utf8');
    const filesApi = readFileSync(resolve(ROOT, 'src/services/api/pocketbase/files.ts'), 'utf8');

    expect(filesApi).toContain('resolveUsersAvatars');
    expect(filesApi).toContain('resolveStoredFileUrls');
    expect(filesApi).toContain('KVARTIRA_FILE_ID_CHUNK');
    expect(filesApi).toContain('resolveConversationAvatars');
    expect(usersApi).toContain('resolveUsersAvatars');
    expect(usersApi).toContain('updateUserRole');
    expect(usersApi).toContain('getUserRoleChangeError');
    expect(groupsApi).toContain('resolveUsersAvatars');
    expect(lessonsApi).toContain('resolveUsersAvatars');
    expect(publicApi).toContain('resolveUsersAvatars');
  });

  it('hot adapters batch file URL and user loads (no per-row resolve in lists)', () => {
    const assignmentsApi = readFileSync(
      resolve(ROOT, 'src/services/api/pocketbase/assignments.ts'),
      'utf8',
    );
    const supportApi = readFileSync(resolve(ROOT, 'src/services/api/pocketbase/support.ts'), 'utf8');
    const eventsApi = readFileSync(resolve(ROOT, 'src/services/api/pocketbase/events.ts'), 'utf8');
    const groupsApi = readFileSync(resolve(ROOT, 'src/services/api/pocketbase/groups.ts'), 'utf8');
    const filesApi = readFileSync(resolve(ROOT, 'src/services/api/pocketbase/files.ts'), 'utf8');

    expect(filesApi).toContain('resolveAssignments');
    expect(filesApi).toContain('resolveSupportTickets');
    expect(assignmentsApi).toContain('resolveAssignments');
    expect(assignmentsApi).not.toContain('list.map(resolveAssignment)');
    expect(supportApi).toContain('resolveSupportTickets');
    expect(supportApi).not.toContain('list.map(resolveSupportTicket)');
    expect(supportApi).toContain('pbEqOr');
    expect(supportApi).toContain('resolveUsersAvatars');
    expect(eventsApi).toContain('resolveStoredFileUrls');
    expect(eventsApi).toContain('presentPbEvents');
    expect(eventsApi).toContain('resolveEventImages');
    expect(eventsApi).not.toContain('records.map((r) => presentPbEvent');
    expect(groupsApi).toContain('PB_USER_ID_CHUNK');
    expect(groupsApi).toContain('pbEqOr');
  });

  it('chat realtime subscribes to PocketBase collections when mode is pocketbase', () => {
    const files = [
      'src/services/chat/realtimeMappers.ts',
      'src/services/chat/realtimePocketbase.ts',
    ];
    for (const file of files) {
      expect(readFileSync(resolve(ROOT, file), 'utf8').length).toBeGreaterThan(0);
    }

    const pocketbaseRealtime = readFileSync(
      resolve(ROOT, 'src/services/chat/realtimePocketbase.ts'),
      'utf8',
    );
    expect(pocketbaseRealtime).toContain("collection('messages').subscribe");
    expect(pocketbaseRealtime).toContain("collection('conversations').subscribe");
    expect(pocketbaseRealtime).toContain("collection('conversation_members').subscribe");

    const realtime = readFileSync(resolve(ROOT, 'src/services/chat/realtime.ts'), 'utf8');
    expect(realtime).toContain('isPocketBaseMode');
    expect(realtime).toContain('PocketBaseChatRealtimeService');
  });

  it('push subscriptions migration creates collection with own-row RBAC', () => {
    const migration = readFileSync(
      resolve(ROOT, 'pocketbase/pb_migrations/1788844800_kvartira_push_subscriptions.js'),
      'utf8',
    );
    expect(migration).toContain("'push_subscriptions'");
    expect(migration).toContain("user = @request.auth.id");
    expect(migration).toContain('idx_push_subscriptions_endpoint');
  });

  it('push hooks dispatch on notification create and lock subscription user', () => {
    const notificationsHook = readFileSync(
      resolve(ROOT, 'pocketbase/pb_hooks/notifications.pb.js'),
      'utf8',
    );
    const pushHook = readFileSync(resolve(ROOT, 'pocketbase/pb_hooks/push.pb.js'), 'utf8');
    const pushLib = readFileSync(resolve(ROOT, 'pocketbase/pb_hooks/lib/kvartiraPush.js'), 'utf8');

    expect(notificationsHook).toContain('onRecordAfterCreateSuccess');
    expect(notificationsHook).toContain('dispatchPushForNotification');
    expect(pushHook).toContain('push_subscriptions');
    expect(pushLib).toContain('WEB_PUSH_RELAY_URL');
    expect(pushLib).toContain('isPushEnabledForUser');
  });
});
