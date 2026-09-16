import { describe, it, expect, beforeEach } from 'vitest';
import {
  NullYClientsSync,
  resetYClientsSync,
  getYClientsSync,
  setYClientsSync,
} from '@/services/integrations/yclients';

describe('YClientsSyncPort', () => {
  beforeEach(() => {
    resetYClientsSync();
  });

  it('NullYClientsSync upserts lesson by externalId', async () => {
    const sync = new NullYClientsSync();
    const first = await sync.upsertLessonFromExternal({
      externalId: 'yc-100',
      studentId: 's1',
      teacherId: 't1',
      directionId: 'd1',
      date: '2026-09-20',
      startTime: '10:00',
      durationMinutes: 60,
      status: 'scheduled',
    });
    expect(first.externalSource).toBe('yclients');
    expect(first.externalId).toBe('yc-100');

    const second = await sync.upsertLessonFromExternal({
      externalId: 'yc-100',
      studentId: 's1',
      teacherId: 't1',
      directionId: 'd1',
      date: '2026-09-21',
      startTime: '11:00',
      durationMinutes: 45,
      status: 'rescheduled',
    });
    expect(second.id).toBe(first.id);
    expect(second.date).toBe('2026-09-21');
    expect(second.startTime).toBe('11:00');
    expect(sync.getStoredLesson('yc-100')?.status).toBe('rescheduled');
  });

  it('listExternalChanges stub returns empty', async () => {
    const sync = getYClientsSync();
    await expect(sync.listExternalChanges()).resolves.toEqual([]);
  });

  it('setYClientsSync swaps active port', async () => {
    const custom = new NullYClientsSync();
    setYClientsSync(custom);
    const lesson = await getYClientsSync().upsertLessonFromExternal({
      externalId: 'yc-9',
      studentId: 's',
      teacherId: 't',
      directionId: 'd',
      date: '2026-09-22',
      startTime: '12:00',
      durationMinutes: 30,
      status: 'scheduled',
    });
    expect(custom.getStoredLesson('yc-9')?.id).toBe(lesson.id);
  });
});
