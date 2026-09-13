import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
  getRegistrationConsentTitle,
  getRegistrationRequiredDocuments,
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
    // Seed consents are on older versions — all service docs need re-accept.
    expect(pending.map((d) => d.id).sort()).toEqual(
      ['legal-personal-data', 'legal-privacy', 'legal-terms'].sort(),
    );
  });

  it('counts pending consents', () => {
    const studentConsents = initialUserConsents.filter((c) => c.userId === student.id);
    expect(countPendingConsents(initialLegalDocuments, studentConsents)).toBe(3);
  });

  it('bumps legal version', () => {
    expect(bumpLegalVersion('1.0')).toBe('1.1');
    expect(bumpLegalVersion('2.0')).toBe('2.1');
  });

  it('lists registration required docs with titles even if required flag is wrongly false', () => {
    const broken = initialLegalDocuments.map((doc) =>
      doc.purpose === 'service' ? { ...doc, required: false as const } : doc,
    );
    const required = getRequiredConsentDocuments(broken);
    expect(required.map((d) => d.id).sort()).toEqual(
      ['legal-personal-data', 'legal-privacy', 'legal-terms'].sort(),
    );

    const registration = getRegistrationRequiredDocuments(broken);
    expect(registration.length).toBeGreaterThanOrEqual(3);
    expect(
      registration.map((d) => getRegistrationConsentTitle(d)).some((t) => t.includes('персональных')),
    ).toBe(true);
    expect(
      registration.map((d) => getRegistrationConsentTitle(d)).some((t) => t.includes('пользовательским соглашением')),
    ).toBe(true);
    expect(
      registration.map((d) => getRegistrationConsentTitle(d)).every((t) => !t.includes('оферт')),
    ).toBe(true);
  });

  it('falls back by type when purpose metadata is missing', () => {
    const stripped = initialLegalDocuments
      .filter((d) =>
        ['legal-personal-data', 'legal-terms', 'legal-privacy'].includes(d.id),
      )
      .map(({ purpose: _p, required: _r, ...doc }) => doc);
    const registration = getRegistrationRequiredDocuments(stripped);
    expect(registration).toHaveLength(3);
  });

  it('pending consent gate lives in AppLayout, profile page has accepted list only', () => {
    const layouts = readFileSync(resolve(process.cwd(), 'src/app/layouts.tsx'), 'utf8');
    const page = readFileSync(
      resolve(process.cwd(), 'src/pages/profile/LegalConsentsPage.tsx'),
      'utf8',
    );
    const modal = readFileSync(
      resolve(process.cwd(), 'src/components/legal/PendingConsentModal.tsx'),
      'utf8',
    );

    expect(layouts).toContain('PendingConsentModal');
    expect(page).toContain('Принятые согласия');
    expect(page).not.toContain('Требуют согласия');
    expect(page).not.toContain('Право на доступ к своим данным');
    expect(modal).toContain('dismissible={false}');
    expect(modal).toContain('ConsentCheckbox');
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
    await api.acceptDocument('legal-personal-data', student.id);
    await api.acceptDocument('legal-terms', student.id);
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

  it('refuses to revoke a service consent', async () => {
    const freshDb = createTestDb();
    freshDb.userConsents = [];
    const freshApi = createMockLegalApi(freshDb, async () => {});

    const serviceDoc = getRequiredConsentDocuments(initialLegalDocuments)[0];
    const serviceConsent = await freshApi.acceptDocument(serviceDoc.id, otherStudent.id);
    await expect(
      freshApi.revokeConsent(serviceConsent.id, otherStudent.id),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('splits required and guardian documents; optional list is empty', () => {
    const required = getRequiredConsentDocuments(initialLegalDocuments);
    const optional = getOptionalConsentDocuments(initialLegalDocuments);
    const guardian = getGuardianConsentDocument(initialLegalDocuments);

    expect(required.every((doc) => doc.purpose === 'service')).toBe(true);
    expect(optional).toEqual([]);
    expect(guardian?.purpose).toBe('minor_guardian');
  });

  it('ships full template texts marked for lawyer review', () => {
    for (const doc of initialLegalDocuments) {
      expect(doc.content).toContain('Шаблон. Проверить у юриста');
      expect(doc.content.length).toBeGreaterThan(200);
    }
    const privacy = initialLegalDocuments.find((d) => d.id === 'legal-privacy')!;
    expect(privacy.content).toContain('QR');
    expect(privacy.content).toContain('cookie');
    expect(privacy.currentVersion).toBe('3.1');
    const terms = initialLegalDocuments.find((d) => d.id === 'legal-terms')!;
    expect(terms.title).toContain('Пользовательское соглашение');
    expect(terms.content).toContain('Пользовательский контент');
    expect(terms.content).toContain('Пожаловаться');
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
    expect(updated.currentVersion).toBe('2.1');
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
        version: '3.2',
      },
      admin.id,
    );
    expect(published.currentVersion).toBe('3.2');
    expect(published.versionHistory[0]?.version).toBe('3.2');
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
          version: '3.0',
        },
        admin.id,
      ),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
