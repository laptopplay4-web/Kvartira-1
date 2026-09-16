import type { ExternalSource, Lesson, LessonStatus } from '@/types';

export type YClientsExternalLessonDto = {
  externalId: string;
  externalSource?: ExternalSource;
  studentId: string;
  teacherId: string;
  directionId: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  status: LessonStatus;
  location?: string;
};

export type YClientsExternalChange = {
  kind: 'lesson.upsert' | 'lesson.cancel';
  externalId: string;
  payload?: YClientsExternalLessonDto;
  observedAt: string;
};

/**
 * Port for inbound/outbound YClients sync. Live API is out of scope until credentials.
 */
export interface YClientsSyncPort {
  upsertLessonFromExternal(dto: YClientsExternalLessonDto): Promise<Lesson>;
  listExternalChanges(since?: string): Promise<YClientsExternalChange[]>;
}

/** In-memory stub for tests and local wiring without API keys. */
export class NullYClientsSync implements YClientsSyncPort {
  private readonly lessons = new Map<string, Lesson>();

  async upsertLessonFromExternal(dto: YClientsExternalLessonDto): Promise<Lesson> {
    const source = dto.externalSource ?? 'yclients';
    const key = `${source}:${dto.externalId}`;
    const now = new Date().toISOString();
    const existing = this.lessons.get(key);
    const lesson: Lesson = {
      id: existing?.id ?? `ext-${dto.externalId}`,
      studentId: dto.studentId,
      teacherId: dto.teacherId,
      directionId: dto.directionId,
      date: dto.date,
      startTime: dto.startTime,
      durationMinutes: dto.durationMinutes,
      status: dto.status,
      externalSource: source,
      externalId: dto.externalId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      ...(dto.location ? { location: dto.location } : {}),
    };
    this.lessons.set(key, lesson);
    return { ...lesson };
  }

  async listExternalChanges(_since?: string): Promise<YClientsExternalChange[]> {
    return [];
  }

  /** Test helper */
  getStoredLesson(externalId: string, source: ExternalSource = 'yclients'): Lesson | undefined {
    return this.lessons.get(`${source}:${externalId}`);
  }
}

let activeSync: YClientsSyncPort = new NullYClientsSync();

export function getYClientsSync(): YClientsSyncPort {
  return activeSync;
}

/** Swap implementation (tests / future live adapter). */
export function setYClientsSync(port: YClientsSyncPort): void {
  activeSync = port;
}

export function resetYClientsSync(): void {
  activeSync = new NullYClientsSync();
}
