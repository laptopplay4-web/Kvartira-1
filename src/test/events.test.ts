import { describe, it, expect, beforeEach } from 'vitest';
import { mockEventsApi, resetMockDatabase, clearMockEventRoster } from '@/services/api/mock';
import { canManageEvents, canRegisterForEvents, canViewSchoolEvent } from '@/services/events/access';
import { isUserRegisteredForEvent } from '@/services/events/registration';
import {
  normalizeCompetitionApplication,
  normalizeEventInput,
  validateCompetitionApplication,
  validateEventInput,
} from '@/services/events/validation';
import { resolveEventImageWriteInput } from '@/services/events/imageWrite';
import {
  filterActiveEvents,
  filterArchivedEvents,
  isEventArchived,
} from '@/services/events/helpers';
import type { SchoolEvent } from '@/types';

describe('validateCompetitionApplication', () => {
  it('requires piece title and composer', () => {
    expect(validateCompetitionApplication({})).toBe('Укажите название произведения');
    expect(
      validateCompetitionApplication({ pieceTitle: 'Aria', composer: '', durationMinutes: 3 }),
    ).toBe('Укажите композитора');
  });

  it('validates duration bounds', () => {
    expect(
      validateCompetitionApplication({
        pieceTitle: 'Aria',
        composer: 'Mozart',
        durationMinutes: 0,
      }),
    ).toBe('Продолжительность от 1 до 30 минут');
  });

  it('accepts valid application', () => {
    expect(
      validateCompetitionApplication({
        pieceTitle: 'Калинка',
        composer: 'Народная',
        durationMinutes: 3,
        category: '13–17 лет',
      }),
    ).toBeNull();
  });
});

describe('validateEventInput', () => {
  it('requires core fields', () => {
    expect(validateEventInput({})).toBe('Укажите название');
    expect(
      validateEventInput({
        title: 'Концерт',
        description: 'Описание',
        type: 'concert',
        date: '2026-12-01',
        startTime: '18:00',
        location: 'Зал',
      }),
    ).toBeNull();
  });

  it('requires invited users for invited type', () => {
    expect(
      validateEventInput({
        title: 'Закрытое',
        description: 'Описание',
        type: 'invited',
        date: '2026-12-01',
        startTime: '18:00',
        location: 'Зал',
      }),
    ).toBe('Укажите приглашённых пользователей');
  });

  it('rejects long http image URLs (signed display URLs must not be written back)', () => {
    const longUrl = `https://cdn.example/${'a'.repeat(480)}.jpg`;
    expect(
      validateEventInput({
        title: 'Концерт',
        description: 'Описание',
        type: 'concert',
        date: '2026-12-01',
        startTime: '18:00',
        location: 'Зал',
        imageUrl: longUrl,
      }),
    ).toMatch(/изображение/);
  });
});

describe('resolveEventImageWriteInput', () => {
  it('keeps stored pbfile when client echoes a signed URL', () => {
    expect(
      resolveEventImageWriteInput(
        'https://pb.example/api/files/x/y?token=long',
        'pbfile:file123',
        true,
      ),
    ).toBe('pbfile:file123');
  });

  it('omits image when not provided', () => {
    expect(resolveEventImageWriteInput(undefined, 'pbfile:file123', false)).toBe('pbfile:file123');
  });

  it('clears image when provided as undefined', () => {
    expect(resolveEventImageWriteInput(undefined, 'pbfile:file123', true)).toBeUndefined();
  });

  it('allows data and pbfile uploads', () => {
    expect(resolveEventImageWriteInput('data:image/jpeg;base64,xx', 'pbfile:old', true)).toBe(
      'data:image/jpeg;base64,xx',
    );
    expect(resolveEventImageWriteInput('pbfile:new', 'pbfile:old', true)).toBe('pbfile:new');
  });
});

describe('normalizeCompetitionApplication', () => {
  it('trims text fields', () => {
    expect(
      normalizeCompetitionApplication({
        pieceTitle: '  Aria  ',
        composer: ' Mozart ',
        durationMinutes: 4,
        category: ' ',
        notes: ' ',
      }),
    ).toEqual({
      pieceTitle: 'Aria',
      composer: 'Mozart',
      durationMinutes: 4,
      category: undefined,
      notes: undefined,
    });
  });
});

describe('mockEventsApi competition registration', () => {
  beforeEach(() => resetMockDatabase());

  it('registers concert without application', async () => {
    const event = await mockEventsApi.register('event-2', 'user-student');
    expect(event.registeredUserIds).toContain('user-student');
  });

  it('requires application for competition', async () => {
    await expect(mockEventsApi.register('event-3', 'user-student')).rejects.toMatchObject({
      code: 'VALIDATION',
    });
  });

  it('stores competition application on register', async () => {
    await mockEventsApi.register('event-3', 'user-student', {
      pieceTitle: 'Калинка',
      composer: 'Народная',
      durationMinutes: 3,
      category: '13–17 лет',
    });

    const registration = await mockEventsApi.getRegistration('event-3', 'user-student');
    expect(registration?.application).toEqual({
      pieceTitle: 'Калинка',
      composer: 'Народная',
      durationMinutes: 3,
      category: '13–17 лет',
    });
  });

  it('removes registration on unregister', async () => {
    await mockEventsApi.register('event-3', 'user-student', {
      pieceTitle: 'Калинка',
      composer: 'Народная',
      durationMinutes: 3,
    });
    await mockEventsApi.unregister('event-3', 'user-student');

    const registration = await mockEventsApi.getRegistration('event-3', 'user-student');
    expect(registration).toBeNull();
  });
});

describe('mockEventsApi events CRUD', () => {
  beforeEach(() => resetMockDatabase());

  it('lists all events for admin', async () => {
    const events = await mockEventsApi.getAllEvents('user-admin');
    expect(events.length).toBeGreaterThanOrEqual(3);
  });

  it('denies CRUD for student', async () => {
    await expect(mockEventsApi.getAllEvents('user-student')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('allows teacher to create, update and delete event', async () => {
    const created = await mockEventsApi.createEvent(
      {
        title: 'Учительский концерт',
        description: 'Описание',
        type: 'concert',
        date: '2026-12-01',
        startTime: '18:00',
        location: 'Зал',
      },
      'user-teacher-1',
    );
    expect(created.id).toMatch(/^event-/);

    const updated = await mockEventsApi.updateEvent(
      created.id,
      { title: 'Обновлённый концерт' },
      'user-teacher-1',
    );
    expect(updated.title).toBe('Обновлённый концерт');

    await mockEventsApi.deleteEvent(created.id, 'user-teacher-1');
    const all = await mockEventsApi.getAllEvents('user-teacher-1');
    expect(all.find((e) => e.id === created.id)).toBeUndefined();
  });

  it('creates, updates and deletes event as admin', async () => {
    const created = await mockEventsApi.createEvent(
      {
        title: 'Тестовый концерт',
        description: 'Описание',
        type: 'concert',
        date: '2026-12-01',
        startTime: '18:00',
        location: 'Зал',
        imageUrl: 'https://cdn.example/concert.jpg',
      },
      'user-admin',
    );
    expect(created.id).toMatch(/^event-/);
    expect(created.imageUrl).toBe('https://cdn.example/concert.jpg');

    const updated = await mockEventsApi.updateEvent(
      created.id,
      { title: 'Обновлённый концерт' },
      'user-admin',
    );
    expect(updated.title).toBe('Обновлённый концерт');
    expect(updated.imageUrl).toBe('https://cdn.example/concert.jpg');

    const updatedEcho = await mockEventsApi.updateEvent(
      created.id,
      {
        title: 'Ещё раз',
        imageUrl: `https://pb.example/api/files/kvartira_files/x/${'t'.repeat(80)}?token=abc`,
      },
      'user-admin',
    );
    // External https kept as-is when stored is not pbfile:
    expect(updatedEcho.imageUrl?.startsWith('https://')).toBe(true);

    const withPbfile = await mockEventsApi.createEvent(
      {
        title: 'С файлом',
        description: 'Описание',
        type: 'concert',
        date: '2026-12-02',
        startTime: '19:00',
        location: 'Зал',
        imageUrl: 'pbfile:evtimg1',
      },
      'user-admin',
    );
    const kept = await mockEventsApi.updateEvent(
      withPbfile.id,
      {
        title: 'С файлом 2',
        imageUrl: `https://pb.example/api/files/${'x'.repeat(60)}?token=${'y'.repeat(40)}`,
      },
      'user-admin',
    );
    expect(kept.title).toBe('С файлом 2');
    expect(kept.imageUrl).toBe('pbfile:evtimg1');

    await mockEventsApi.deleteEvent(created.id, 'user-admin');
    await mockEventsApi.deleteEvent(withPbfile.id, 'user-admin');
    const all = await mockEventsApi.getAllEvents('user-admin');
    expect(all.find((e) => e.id === created.id)).toBeUndefined();
  });
});

describe('canManageEvents', () => {
  it('allows teacher and admin, denies student', () => {
    expect(canManageEvents({ role: 'teacher' })).toBe(true);
    expect(canManageEvents({ role: 'admin' })).toBe(true);
    expect(canManageEvents({ role: 'student' })).toBe(false);
    expect(canManageEvents(null)).toBe(false);
  });
});

describe('canRegisterForEvents', () => {
  it('allows only students', () => {
    expect(canRegisterForEvents({ role: 'student' })).toBe(true);
    expect(canRegisterForEvents({ role: 'teacher' })).toBe(false);
    expect(canRegisterForEvents({ role: 'admin' })).toBe(false);
  });
});

describe('canViewSchoolEvent', () => {
  it('hides invited events from users who are not on the list', () => {
    const invited = {
      type: 'invited' as const,
      invitedUserIds: ['user-student'],
    };
    expect(canViewSchoolEvent('user-student', invited)).toBe(true);
    expect(canViewSchoolEvent('user-teacher-1', invited)).toBe(false);
    expect(canViewSchoolEvent('user-student', { type: 'concert' })).toBe(true);
  });

  it('lets teacher and admin see invited events for management', () => {
    const invited = {
      type: 'invited' as const,
      invitedUserIds: ['user-student'],
    };
    expect(canViewSchoolEvent('user-teacher-1', invited, { role: 'teacher' })).toBe(true);
    expect(canViewSchoolEvent('user-admin', invited, { role: 'admin' })).toBe(true);
    expect(canViewSchoolEvent('user-other', invited, { role: 'student' })).toBe(false);
  });
});

describe('event archive helpers', () => {
  const now = new Date('2026-09-13T12:00:00');

  const base = {
    title: 'E',
    description: '',
    type: 'concert' as const,
    location: 'Hall',
    registeredUserIds: [] as string[],
  };

  it('archives by endTime when set, otherwise by startTime', () => {
    const withEnd: SchoolEvent = {
      ...base,
      id: 'a',
      date: '2026-09-13',
      startTime: '10:00',
      endTime: '11:00',
    };
    const ongoing: SchoolEvent = {
      ...base,
      id: 'b',
      date: '2026-09-13',
      startTime: '10:00',
      endTime: '18:00',
    };
    const noEndPast: SchoolEvent = {
      ...base,
      id: 'c',
      date: '2026-09-13',
      startTime: '09:00',
    };

    expect(isEventArchived(withEnd, now)).toBe(true);
    expect(isEventArchived(ongoing, now)).toBe(false);
    expect(isEventArchived(noEndPast, now)).toBe(true);
  });

  it('splits active and archived lists', () => {
    const list: SchoolEvent[] = [
      { ...base, id: 'past', date: '2026-01-01', startTime: '12:00', endTime: '14:00' },
      { ...base, id: 'future', date: '2099-01-01', startTime: '12:00', endTime: '14:00' },
    ];
    expect(filterActiveEvents(list, now).map((e) => e.id)).toEqual(['future']);
    expect(filterArchivedEvents(list, now).map((e) => e.id)).toEqual(['past']);
  });
});

describe('normalizeEventInput', () => {
  it('trims text fields and drops empty imageUrl', () => {
    expect(
      normalizeEventInput({
        title: '  Концерт  ',
        description: ' Описание ',
        type: 'concert',
        date: ' 2026-12-01 ',
        startTime: ' 18:00 ',
        endTime: ' ',
        location: ' Зал ',
        imageUrl: '  ',
      }),
    ).toMatchObject({
      title: 'Концерт',
      description: 'Описание',
      date: '2026-12-01',
      startTime: '18:00',
      endTime: undefined,
      location: 'Зал',
      imageUrl: undefined,
    });
  });
});

describe('event registration count + staff notify + participants', () => {
  beforeEach(() => resetMockDatabase());

  it('register creates registration, updates count, notifies staff', async () => {
    const { mockNotificationsApi } = await import('@/services/api/mock');
    const beforeAdmin = (await mockNotificationsApi.getNotifications('user-admin')).filter(
      (n) => n.type === 'event',
    ).length;
    const beforeTeacher = (await mockNotificationsApi.getNotifications('user-teacher-1')).filter(
      (n) => n.type === 'event',
    ).length;

    const event = await mockEventsApi.register('event-2', 'user-student');
    expect(event.registeredCount).toBe(1);
    expect(event.isRegistered).toBe(true);

    const registration = await mockEventsApi.getRegistration('event-2', 'user-student');
    expect(registration?.userId).toBe('user-student');

    const adminNotifs = await mockNotificationsApi.getNotifications('user-admin');
    const teacherNotifs = await mockNotificationsApi.getNotifications('user-teacher-1');
    expect(
      adminNotifs.filter(
        (n) =>
          n.type === 'event' &&
          n.title === 'Новая запись на мероприятие' &&
          n.link?.startsWith('/events/event-2'),
      ).length,
    ).toBe(beforeAdmin + 1);
    expect(
      teacherNotifs.filter(
        (n) =>
          n.type === 'event' &&
          n.title === 'Новая запись на мероприятие' &&
          n.link?.startsWith('/events/event-2'),
      ).length,
    ).toBe(beforeTeacher + 1);
    expect(
      adminNotifs.some(
        (n) => n.link === '/events/event-2?p=user-student&c=join',
      ),
    ).toBe(true);
  });

  it('createEvent notifies students (not staff) for events badge', async () => {
    const { mockNotificationsApi } = await import('@/services/api/mock');
    const beforeStudent = (await mockNotificationsApi.getNotifications('user-student')).filter(
      (n) => n.type === 'event',
    ).length;
    const beforeAdmin = (await mockNotificationsApi.getNotifications('user-admin')).filter(
      (n) => n.type === 'event',
    ).length;

    const created = await mockEventsApi.createEvent(
      {
        title: 'Открытый урок',
        description: 'Приходите все',
        type: 'masterclass',
        date: '2026-12-20',
        startTime: '16:00',
        location: 'Зал',
      },
      'user-admin',
    );

    const studentNotifs = await mockNotificationsApi.getNotifications('user-student');
    const newOnes = studentNotifs.filter(
      (n) => n.type === 'event' && n.link === `/events/${created.id}`,
    );
    expect(newOnes).toHaveLength(1);
    expect(newOnes[0]?.title).toBe('Новое мероприятие');
    expect(studentNotifs.filter((n) => n.type === 'event').length).toBe(beforeStudent + 1);
    const adminNotifs = await mockNotificationsApi.getNotifications('user-admin');
    expect(
      adminNotifs.filter((n) => n.type === 'event' && n.link === `/events/${created.id}`).length,
    ).toBe(beforeAdmin);
  });

  it('invited createEvent notifies only invited students', async () => {
    const { mockNotificationsApi } = await import('@/services/api/mock');
    const created = await mockEventsApi.createEvent(
      {
        title: 'Закрытый вечер',
        description: 'По приглашению',
        type: 'invited',
        date: '2026-12-21',
        startTime: '19:00',
        location: 'Зал',
        invitedUserIds: ['user-student'],
      },
      'user-admin',
    );

    const studentNotifs = await mockNotificationsApi.getNotifications('user-student');
    expect(
      studentNotifs.some((n) => n.type === 'event' && n.link === `/events/${created.id}`),
    ).toBe(true);

    const other = await mockNotificationsApi.getNotifications('user-student-2');
    expect(other.some((n) => n.type === 'event' && n.link === `/events/${created.id}`)).toBe(
      false,
    );
  });

  it('student sees registeredCount not inflated roster', async () => {
    await mockEventsApi.register('event-2', 'user-student');
    const event = await mockEventsApi.getEvent('event-2', 'user-student');
    expect(event.registeredCount).toBe(1);
    expect(event.registeredUserIds).toEqual(['user-student']);
    expect(event.isRegistered).toBe(true);
  });

  it('register response keeps isRegistered for immediate CTA switch', async () => {
    const event = await mockEventsApi.register('event-2', 'user-student');
    expect(event.isRegistered).toBe(true);
    expect(isUserRegisteredForEvent(event, 'user-student')).toBe(true);
  });

  it('staff can list participants; student cannot', async () => {
    await mockEventsApi.register('event-2', 'user-student');
    const participants = await mockEventsApi.getEventParticipants('event-2', 'user-admin');
    expect(participants.some((u) => u.id === 'user-student')).toBe(true);
    const asTeacher = await mockEventsApi.getEventParticipants('event-2', 'user-teacher-1');
    expect(asTeacher.some((u) => u.id === 'user-student')).toBe(true);
    await expect(
      mockEventsApi.getEventParticipants('event-2', 'user-student'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('lists participants from registrations even if roster empty', async () => {
    await mockEventsApi.register('event-2', 'user-student');
    clearMockEventRoster('event-2');
    const participants = await mockEventsApi.getEventParticipants('event-2', 'user-admin');
    expect(participants.map((u) => u.id)).toContain('user-student');
  });

  it('denies teacher and admin from registering', async () => {
    await expect(mockEventsApi.register('event-2', 'user-teacher-1')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(mockEventsApi.register('event-2', 'user-admin')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('unregister frees seat and notifies staff', async () => {
    const { mockNotificationsApi } = await import('@/services/api/mock');
    await mockEventsApi.register('event-2', 'user-student');
    const before = (await mockNotificationsApi.getNotifications('user-admin')).filter(
      (n) => n.type === 'event' && n.link?.startsWith('/events/event-2'),
    ).length;

    const event = await mockEventsApi.unregister('event-2', 'user-student');
    expect(event.registeredCount).toBe(0);
    expect(event.isRegistered).toBe(false);
    expect(await mockEventsApi.getRegistration('event-2', 'user-student')).toBeNull();

    const adminNotifs = await mockNotificationsApi.getNotifications('user-admin');
    const cancelNotifs = adminNotifs.filter(
      (n) =>
        n.type === 'event' &&
        n.link === '/events/event-2?p=user-student&c=leave' &&
        n.title === 'Отмена участия в мероприятии',
    );
    expect(cancelNotifs.length).toBeGreaterThanOrEqual(1);
    expect(
      adminNotifs.filter((n) => n.type === 'event' && n.link?.startsWith('/events/event-2'))
        .length,
    ).toBe(before + 1);
  });

  it('staff can remove participant; student cannot', async () => {
    const { mockNotificationsApi } = await import('@/services/api/mock');
    await mockEventsApi.register('event-2', 'user-student');

    await expect(
      mockEventsApi.removeEventParticipant('event-2', 'user-student', 'user-student'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const event = await mockEventsApi.removeEventParticipant(
      'event-2',
      'user-student',
      'user-admin',
    );
    expect(event.registeredCount).toBe(0);
    expect(await mockEventsApi.getRegistration('event-2', 'user-student')).toBeNull();
    expect(
      (await mockEventsApi.getEventParticipants('event-2', 'user-admin')).some(
        (u) => u.id === 'user-student',
      ),
    ).toBe(false);

    const adminNotifs = await mockNotificationsApi.getNotifications('user-admin');
    expect(
      adminNotifs.some(
        (n) =>
          n.type === 'event' &&
          n.link === '/events/event-2?p=user-student&c=leave' &&
          n.title === 'Участник удалён с мероприятия',
      ),
    ).toBe(true);
  });

  it('denies teacher unregister (students only)', async () => {
    await expect(mockEventsApi.unregister('event-2', 'user-teacher-1')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('event unread helpers', () => {
  it('counts nav badge after tab seen and per-event +N', async () => {
    const {
      countUnreadEventParticipationsForNav,
      countUnreadForEvent,
      markEventsTabSeen,
      eventIdFromNotificationLink,
    } = await import('@/services/events/unread');

    expect(eventIdFromNotificationLink('/events/event-2')).toBe('event-2');
    expect(eventIdFromNotificationLink('/events/event-2?p=u1&c=leave')).toBe('event-2');

    const notifications = [
      {
        id: '1',
        read: false,
        type: 'event' as const,
        link: '/events/event-2',
        createdAt: '2026-09-12T10:00:00.000Z',
      },
      {
        id: '2',
        read: false,
        type: 'event' as const,
        link: '/events/event-2',
        createdAt: '2026-09-12T11:00:00.000Z',
      },
      {
        id: '3',
        read: false,
        type: 'event' as const,
        link: '/events/event-1',
        createdAt: '2026-09-12T12:00:00.000Z',
      },
    ];

    expect(countUnreadForEvent(notifications, 'event-2')).toBe(2);
    expect(countUnreadEventParticipationsForNav(notifications, 'user-admin')).toBe(3);

    markEventsTabSeen('user-admin', '2026-09-12T11:30:00.000Z');
    expect(countUnreadEventParticipationsForNav(notifications, 'user-admin')).toBe(1);
    expect(countUnreadForEvent(notifications, 'event-2')).toBe(2);

    // Ученик: бейдж не сбрасывается визитом вкладки — только markAsRead на деталке.
    expect(
      countUnreadEventParticipationsForNav(notifications, 'user-student', {
        ignoreTabSeen: true,
      }),
    ).toBe(3);
  });

  it('card highlight clears on detail open; participants badge stays until read', async () => {
    const {
      countUnreadForEvent,
      markEventCardSeen,
      shouldHighlightEventCard,
    } = await import('@/services/events/unread');

    const notifications = [
      {
        id: '1',
        read: false,
        type: 'event' as const,
        link: '/events/event-2',
        createdAt: '2026-09-12T10:00:00.000Z',
      },
      {
        id: '2',
        read: false,
        type: 'event' as const,
        link: '/events/event-2',
        createdAt: '2026-09-12T11:00:00.000Z',
      },
    ];

    expect(shouldHighlightEventCard(notifications, 'user-admin', 'event-2')).toBe(true);
    expect(countUnreadForEvent(notifications, 'event-2')).toBe(2);

    markEventCardSeen('user-admin', 'event-2', '2026-09-12T11:30:00.000Z');
    expect(shouldHighlightEventCard(notifications, 'user-admin', 'event-2')).toBe(false);
    expect(countUnreadForEvent(notifications, 'event-2')).toBe(2);
  });

  it('summarizes join/leave deltas and participant ids from notify links', async () => {
    const {
      summarizeUnreadParticipationDelta,
      getUnreadParticipationParticipantIds,
      parseEventParticipationLink,
      eventParticipationNotifyLink,
    } = await import('@/services/events/unread');

    expect(eventParticipationNotifyLink('event-2', 'user-a', 'join')).toBe(
      '/events/event-2?p=user-a&c=join',
    );
    expect(parseEventParticipationLink('/events/event-2?p=user-b&c=leave')).toEqual({
      eventId: 'event-2',
      participantId: 'user-b',
      change: 'leave',
    });

    const notifications = [
      {
        id: '1',
        read: false,
        type: 'event' as const,
        title: 'Новая запись на мероприятие',
        link: '/events/event-2?p=user-a&c=join',
        createdAt: '2026-09-12T10:00:00.000Z',
      },
      {
        id: '2',
        read: false,
        type: 'event' as const,
        title: 'Новая запись на мероприятие',
        link: '/events/event-2?p=user-c&c=join',
        createdAt: '2026-09-12T10:05:00.000Z',
      },
      {
        id: '3',
        read: false,
        type: 'event' as const,
        title: 'Отмена участия в мероприятии',
        link: '/events/event-2?p=user-b&c=leave',
        createdAt: '2026-09-12T11:00:00.000Z',
      },
      {
        id: '4',
        read: false,
        type: 'event' as const,
        title: 'Новое мероприятие',
        link: '/events/event-2',
        createdAt: '2026-09-12T12:00:00.000Z',
      },
    ];

    expect(summarizeUnreadParticipationDelta(notifications, 'event-2')).toEqual({
      joins: 2,
      leaves: 1,
    });
    expect(getUnreadParticipationParticipantIds(notifications, 'event-2', 'join')).toEqual([
      'user-a',
      'user-c',
    ]);
    expect(getUnreadParticipationParticipantIds(notifications, 'event-2', 'leave')).toEqual([
      'user-b',
    ]);
  });
});

describe('event image crop helpers', () => {
  it('covers viewport with initial 16:9 crop and clamps zoom', async () => {
    const {
      getInitialEventCropState,
      getEventCropZoomBounds,
      clampEventCropState,
      zoomEventCropAtPoint,
      validateEventImageFile,
      EVENT_IMAGE_ASPECT,
    } = await import('@/services/events/imageCrop');

    const vw = 320;
    const vh = Math.round(vw / EVENT_IMAGE_ASPECT);
    const state = getInitialEventCropState(800, 600, vw, vh);
    expect(state.scale).toBeGreaterThan(0);
    // Image must cover both axes
    expect(800 * state.scale).toBeGreaterThanOrEqual(vw - 0.01);
    expect(600 * state.scale).toBeGreaterThanOrEqual(vh - 0.01);

    const bounds = getEventCropZoomBounds(800, 600, vw, vh);
    const zoomed = clampEventCropState(
      zoomEventCropAtPoint(state, bounds.maxScale * 2, vw / 2, vh / 2),
      800,
      600,
      vw,
      vh,
    );
    expect(zoomed.scale).toBeCloseTo(bounds.maxScale);

    expect(validateEventImageFile({ name: 'a.jpg', type: 'image/jpeg', size: 100 }).valid).toBe(
      true,
    );
    expect(validateEventImageFile({ name: 'a.txt', type: 'text/plain', size: 10 }).valid).toBe(
      false,
    );
  });
});
