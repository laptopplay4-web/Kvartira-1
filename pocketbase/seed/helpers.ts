/**
 * Seed helpers — ID mapping, phone→email, PB field transforms.
 * ROADMAP 1.5
 */

import { DEMO_ACCOUNTS } from '../../src/mocks/seed';

/** Mock seed typo: consents reference user-teacher, actual id is user-teacher-1 */
const ID_ALIASES: Record<string, string> = {
  'user-teacher': 'user-teacher-1',
};

export class IdMap {
  private readonly map = new Map<string, string>();

  set(mockId: string, pbId: string): void {
    this.map.set(mockId, pbId);
  }

  get(mockId: string): string {
    const key = ID_ALIASES[mockId] ?? mockId;
    const pbId = this.map.get(key);
    if (!pbId) throw new Error(`ID not mapped: ${mockId}`);
    return pbId;
  }

  tryGet(mockId: string | undefined): string | undefined {
    if (!mockId) return undefined;
    const key = ID_ALIASES[mockId] ?? mockId;
    return this.map.get(key);
  }

  remapIds(ids: string[]): string[] {
    return ids.map((id) => this.get(id));
  }
}

export function phoneToEmail(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `${digits || 'unknown'}@kvartira.local`;
}

export function passwordForPhone(phone: string): string {
  if (phone === DEMO_ACCOUNTS.student.phone) return DEMO_ACCOUNTS.student.password;
  if (phone === DEMO_ACCOUNTS.teacher.phone) return DEMO_ACCOUNTS.teacher.password;
  if (phone === DEMO_ACCOUNTS.admin.phone) return DEMO_ACCOUNTS.admin.password;
  return 'password';
}

export { toPbSkillLevel } from '../../src/services/progress/skillLevel';

export function remapLink(link: string | undefined, ids: IdMap): string | undefined {
  if (!link) return link;
  return link.replace(
    /\/(lessons|chat|assignments|events|profile\/help)\/([^/?#]+)/g,
    (_match, segment: string, mockId: string) => {
      const pbId = ids.tryGet(mockId);
      return pbId ? `/${segment}/${pbId}` : `/${segment}/${mockId}`;
    },
  );
}

export function remapMetadata(
  metadata: Record<string, unknown> | undefined,
  ids: IdMap,
): Record<string, unknown> | undefined {
  if (!metadata) return metadata;
  const next = { ...metadata };
  if (typeof next.lessonId === 'string') {
    const mapped = ids.tryGet(next.lessonId);
    if (mapped) next.lessonId = mapped;
  }
  return next;
}

export async function patchRecordTimestamps(
  client: import('./pbClient').PbClient,
  collection: string,
  id: string,
  createdAt: string,
  updatedAt?: string,
): Promise<void> {
  await client.updateRecord(collection, id, {
    created: createdAt,
    updated: updatedAt ?? createdAt,
  });
}
