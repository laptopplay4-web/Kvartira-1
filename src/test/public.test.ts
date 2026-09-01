import { describe, it, expect } from 'vitest';
import { ApiError } from '@/services/api/types';
import { createMockPublicApi } from '@/services/api/mock/public';
import { filterPublicEvents, toPublicEvent, toPublicTeacher } from '@/services/public/helpers';
import { directions, events, publicSchoolInfo, teacherDirections, users } from '@/mocks/seed';
import type { SchoolEvent } from '@/types';
const teacher = users.find((u) => u.id === 'user-teacher-1')!;

function createTestDb() {
  return {
    users: [...users],
    events: structuredClone(events) as SchoolEvent[],
    schoolInfo: structuredClone(publicSchoolInfo),
  };
}

describe('public helpers', () => {
  it('toPublicTeacher strips phone and maps directions', () => {
    const result = toPublicTeacher(teacher, teacherDirections[teacher.id], directions);
    expect(result).not.toHaveProperty('phone');
    expect(result.directions).toHaveLength(1);
    expect(result.directions[0].name).toBe('Вокал');
  });

  it('toPublicEvent excludes invited and past events', () => {
    const now = new Date('2026-01-01T12:00:00');
    const invited: SchoolEvent = {
      id: 'inv',
      title: 'Private',
      description: 'Invite only',
      type: 'invited',
      date: '2026-06-01',
      startTime: '18:00',
      location: 'Studio',
      registeredUserIds: [],
      invitedUserIds: ['user-student'],
    };
    const past: SchoolEvent = {
      id: 'past',
      title: 'Past concert',
      description: 'Done',
      type: 'concert',
      date: '2025-01-01',
      startTime: '18:00',
      location: 'Hall',
      registeredUserIds: [],
    };

    expect(toPublicEvent(invited, now)).toBeNull();
    expect(toPublicEvent(past, now)).toBeNull();
    expect(toPublicEvent(events[0], now)?.id).toBe('event-1');
  });

  it('filterPublicEvents sorts by date and computes spotsLeft', () => {
    const now = new Date('2026-01-01T12:00:00');
    const list = filterPublicEvents(events, now);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].date <= list[list.length - 1].date).toBe(true);
    const masterclass = list.find((e) => e.id === 'event-2');
    expect(masterclass?.spotsLeft).toBe(12);
  });
});

describe('public API', () => {
  it('getLandingData returns school info without sensitive fields', async () => {
    const api = createMockPublicApi(createTestDb(), async () => {});
    const data = await api.getLandingData();

    expect(data.school.name).toBe('Квартира');
    expect(data.directions.length).toBeGreaterThanOrEqual(4);
    expect(data.teachers.every((t) => !('phone' in t))).toBe(true);
    expect(data.events.length).toBeGreaterThan(0);
    expect(data.news.length).toBeGreaterThan(0);
  });

  it('getDirection returns direction with teachers and no phone', async () => {
    const api = createMockPublicApi(createTestDb(), async () => {});
    const data = await api.getDirection('dir-vocal');

    expect(data.name).toBe('Вокал');
    expect(data.teachers).toHaveLength(1);
    expect(data.teachers[0].firstName).toBe('Елена');
    expect(data.teachers.every((t) => !('phone' in t))).toBe(true);
  });

  it('getDirection throws 404 for unknown id', async () => {
    const api = createMockPublicApi(createTestDb(), async () => {});
    await expect(api.getDirection('missing')).rejects.toMatchObject({
      status: 404,
    });
    await expect(api.getDirection('missing')).rejects.toBeInstanceOf(ApiError);
  });

  it('getTeacher returns public profile without phone', async () => {
    const api = createMockPublicApi(createTestDb(), async () => {});
    const data = await api.getTeacher('user-teacher-2');

    expect(data.firstName).toBe('Дмитрий');
    expect(data.directions).toHaveLength(2);
    expect(data).not.toHaveProperty('phone');
  });

  it('getTeacher throws 404 for non-teacher or missing user', async () => {
    const api = createMockPublicApi(createTestDb(), async () => {});
    await expect(api.getTeacher('user-student')).rejects.toMatchObject({ status: 404 });
    await expect(api.getTeacher('missing')).rejects.toMatchObject({ status: 404 });
  });
});