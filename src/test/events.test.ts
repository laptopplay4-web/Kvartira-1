import { describe, it, expect, beforeEach } from 'vitest';
import { mockEventsApi, resetMockDatabase } from '@/services/api/mock';
import { canManageEvents, canViewSchoolEvent } from '@/services/events/access';
import {
  normalizeCompetitionApplication,
  normalizeEventInput,
  validateCompetitionApplication,
  validateEventInput,
} from '@/services/events/validation';

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

    await mockEventsApi.deleteEvent(created.id, 'user-admin');
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
