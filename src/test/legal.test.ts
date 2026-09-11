import { describe, it, expect, beforeEach } from 'vitest';
import { can } from '@/permissions';
import {
  canAcceptDocument,
  canManageLegalDocuments,
  canViewConsentRecord,
  canViewOwnConsents,
} from '@/services/legal/access';
import {
  countPendingConsents,
  bumpLegalVersion,
  getGuardianConsentDocument,
  getOptionalConsentDocuments,
  getPendingConsents,
  getRequiredConsentDocuments,
  hasCurrentConsent,
  sortDocumentsByType,
} from '@/services/legal/helpers';
import { createMockLegalApi } from '@/services/api/mock/legal';
import { initialLegalDocuments, initialUserConsents, users } from '@/mocks/seed';
import { ApiError } from '@/services/api/types';

const student = users.find((u) => u.id === 'user-student')!;
const otherStudent = users.find((u) => u.id === 'user-student-2')!;
const admin = users.find((u) => u.id === 'user-admin')!;

function createTestDb() {
  return {
    users: [...users],
    legalDocuments: structuredClone(initialLegalDocuments),
    userConsents: structuredClone(initialUserConsents),
  };
}

describe('legal access', () => {
  it('user can view own consents only', () => {
    expect(canViewOwnConsents(student, student.id)).toBe(true);
    expect(canViewOwnConsents(student, otherStudent.id)).toBe(false);
  });

  it('user can accept documents for self', () => {
    expect(canAcceptDocument(student, student.id)).toBe(true);
    expect(canAcceptDocument(student, otherStudent.id)).toBe(false);
  });

  it('admin can manage legal documents', () => {
    expect(canManageLegalDocuments(admin)).toBe(true);
    expect(canManageLegalDocuments(student)).toBe(false);
  });

  it('all roles have legal view and accept permissions', () => {
    expect(can(student, 'legal:view-own')).toBe(true);
    expect(can(student, 'legal:accept')).toBe(true);
    expect(can({ ...student, role: 'teacher' }, 'legal:accept')).toBe(true);
    expect(can(admin, 'legal:manage')).toBe(true);
    expect(can(student, 'legal:manage')).toBe(false);
  });

  it('can view consent record for owner only', () => {
    const consent = initialUserConsents[0]!;
    expect(canViewConsentRecord(student, consent)).toBe(true);
    expect(canViewConsentRecord(otherStudent, consent)).toBe(false);
  });
});

describe('legal helpers', () => {
  it('sorts documents by type', () => {
    const sorted = sortDocumentsByType([...initialLegalDocuments].reverse());
    expect(sorted[0]?.type).toBe('privacy_policy');
    expect(sorted.at(-1)?.type).toBe('school_rules');
  });

  it('detects outdated consent', () => {
    const studentConsents = initialUserConsents.filter((c) => c.userId === student.id);
    const privacy = initialLegalDocuments.find((d) => d.id === 'legal-privacy')!;
    expect(hasCurrentConsent(studentConsents, privacy)).toBe(false);
  });

  it('returns pending consents for student', () => {
    const studentConsents = initialUserConsents.filter((c) => c.userId === student.id);
    const pending = getPendingConsents(initialLegalDocuments, studentConsents);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.id).toBe('legal-privacy');
  });

  it('counts pending consents', () => {
    const studentConsents = initialUserConsents.filter((c) => c.userId === student.id);
    expect(countPendingConsents(initialLegalDocuments, studentConsents)).toBe(1);
  });

  it('bumps legal version', () => {
    expect(bumpLegalVersion('1.0')).toBe('1.1');
    expect(bumpLegalVersion('2.0')).toBe('2.1');
  });
});

describe('legal api', () => {
  let db: ReturnType<typeof createTestDb>;
  let api: ReturnType<typeof createMockLegalApi>;

  beforeEach(() => {
    db = createTestDb();
    api = createMockLegalApi(db, async () => {});
  });

  it('returns all documents publicly', async () => {
    const docs = await api.getDocuments();
    expect(docs).toHaveLength(initialLegalDocuments.length);
  });

  it('returns document by id', async () => {
    const doc = await api.getDocument('legal-terms');
    expect(doc.title).toContain('соглашение');
  });

  it('returns user consents for requester', async () => {
    const consents = await api.getUserConsents(student.id);
    expect(consents.length).toBeGreaterThan(0);
    expect(consents.every((c) => c.userId === student.id)).toBe(true);
  });

  it('accepts document and updates pending list', async () => {
    await api.acceptDocument('legal-privacy', student.id);
    const pending = await api.getPendingConsents(student.id);
    expect(pending).toHaveLength(0);
  });

  it('accepts multiple documents at once', async () => {
    const freshDb = createTestDb();
    freshDb.userConsents = [];
    const freshApi = createMockLegalApi(freshDb, async () => {});
    const required = getRequiredConsentDocuments(initialLegalDocuments).map((d) => d.id);
    const consents = await freshApi.acceptDocuments(required, otherStudent.id);
    expect(consents).toHaveLength(required.length);
    expect(consents.every((c) => c.purpose === 'service')).toBe(true);
  });

  it('records the legal representative on a guardian consent', async () => {
    const freshDb = createTestDb();
    freshDb.userConsents = [];
    const freshApi = createMockLegalApi(freshDb, async () => {});
    const guardianDoc = getGuardianConsentDocument(initialLegalDocuments)!;

    await expect(
      freshApi.acceptDocument(guardianDoc.id, otherStudent.id),
    ).rejects.toBeInstanceOf(ApiError);

    const consent = await freshApi.acceptDocument(guardianDoc.id, otherStudent.id, {
      guardian: { fullName: 'Иванова Мария Петровна', phone: '+79001112233', relation: 'мама' },
    });
    expect(consent.purpose).toBe('minor_guardian');
    expect(consent.guardian?.fullName).toBe('Иванова Мария Петровна');
  });

  it('keeps optional and guardian consents out of the pending list', async () => {
    const freshDb = createTestDb();
    freshDb.userConsents = [];
    const freshApi = createMockLegalApi(freshDb, async () => {});

    const pending = await freshApi.getPendingConsents(otherStudent.id);
    expect(pending.every((doc) => doc.purpose === 'service')).toBe(true);
  });

  it('revokes an optional consent but refuses to revoke the service one', async () => {
    const freshDb = createTestDb();
    freshDb.userConsents = [];
    const freshApi = createMockLegalApi(freshDb, async () => {});

    const optional = getOptionalConsentDocuments(initialLegalDocuments)[0];
    const accepted = await freshApi.acceptDocument(optional.id, otherStudent.id);
    const revoked = await freshApi.revokeConsent(accepted.id, otherStudent.id);
    expect(revoked.revokedAt).toBeTruthy();

    const serviceDoc = getRequiredConsentDocuments(initialLegalDocuments)[0];
    const serviceConsent = await freshApi.acceptDocument(serviceDoc.id, otherStudent.id);
    await expect(
      freshApi.revokeConsent(serviceConsent.id, otherStudent.id),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('splits required, optional and guardian documents by purpose', () => {
    const required = getRequiredConsentDocuments(initialLegalDocuments);
    const optional = getOptionalConsentDocuments(initialLegalDocuments);
    const guardian = getGuardianConsentDocument(initialLegalDocuments);

    expect(required.every((doc) => doc.purpose === 'service')).toBe(true);
    expect(optional.every((doc) => doc.purpose === 'communication' || doc.purpose === 'publication')).toBe(
      true,
    );
    expect(guardian?.purpose).toBe('minor_guardian');
    expect(optional.some((doc) => doc.id === guardian?.id)).toBe(false);
  });

  it('ships full template texts marked for lawyer review', () => {
    for (const doc of initialLegalDocuments) {
      expect(doc.content).toContain('Шаблон. Проверить у юриста');
      expect(doc.content.length).toBeGreaterThan(200);
    }
  });

  it('rejects accept for non-consent document', async () => {
    await expect(api.acceptDocument('legal-school-rules', student.id)).rejects.toBeInstanceOf(ApiError);
  });

  it('reports manage permission for admin', async () => {
    expect(await api.canManageDocuments(admin.id)).toBe(true);
    expect(await api.canManageDocuments(student.id)).toBe(false);
  });

  it('updates document for admin', async () => {
    const updated = await api.updateDocument(
      'legal-school-rules',
      { title: 'Обновлённые правила школы', content: 'Новый текст правил школы для демо.' },
      admin.id,
    );
    expect(updated.title).toBe('Обновлённые правила школы');
    expect(updated.currentVersion).toBe('1.0');
  });

  it('rejects update for non-admin', async () => {
    await expect(
      api.updateDocument('legal-school-rules', { title: 'Hack' }, student.id),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('publishes new version and invalidates old consent', async () => {
    await api.acceptDocument('legal-privacy', student.id);
    const published = await api.publishVersion(
      'legal-privacy',
      {
        content: 'Обновлённая политика конфиденциальности для демо.',
        changeSummary: 'Уточнены сроки хранения данных.',
        effectiveAt: '2026-09-01',
        version: '2.1',
      },
      admin.id,
    );
    expect(published.currentVersion).toBe('2.1');
    expect(published.versionHistory[0]?.version).toBe('2.1');
    const pending = await api.getPendingConsents(student.id);
    expect(pending.some((doc) => doc.id === 'legal-privacy')).toBe(true);
  });

  it('rejects publish with same version', async () => {
    await expect(
      api.publishVersion(
        'legal-terms',
        {
          content: 'Текст пользовательского соглашения для демо.',
          changeSummary: 'Без изменений по сути.',
          effectiveAt: '2026-09-01',
          version: '1.0',
        },
        admin.id,
      ),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
