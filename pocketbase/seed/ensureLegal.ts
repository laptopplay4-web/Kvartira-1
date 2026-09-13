/**
 * Upsert legal documents for registration/consents without wiping users.
 * Does not import mocks/seed.ts (avoids @/ path issues under tsx CLI).
 */

import {
  LEGAL_GUARDIAN_CONSENT_TEXT,
  LEGAL_PERSONAL_DATA_CONSENT_TEXT,
  LEGAL_PRIVACY_POLICY_TEXT,
  LEGAL_SCHOOL_RULES_TEXT,
  LEGAL_TERMS_OF_SERVICE_TEXT,
} from '../../src/services/legal/documentTexts';
import type { PbClient } from './pbClient';

interface SeedLegalDoc {
  type: string;
  purpose: string;
  title: string;
  content: string;
  currentVersion: string;
  effectiveAt: string;
  requiresConsent: boolean;
  required: boolean;
  versionHistory: Array<{ version: string; effectiveAt: string; changeSummary: string }>;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildLegalDocuments(): SeedLegalDoc[] {
  const today = todayISO();
  return [
    {
      type: 'privacy_policy',
      purpose: 'service',
      title: 'Политика конфиденциальности',
      content: LEGAL_PRIVACY_POLICY_TEXT,
      currentVersion: '3.1',
      effectiveAt: today,
      requiresConsent: true,
      required: true,
      versionHistory: [
        {
          version: '3.1',
          effectiveAt: today,
          changeSummary:
            'Чат = закрытый учебный процесс; публикация вне PWA; права без optional-отзыва.',
        },
      ],
    },
    {
      type: 'personal_data',
      purpose: 'service',
      title: 'Согласие на обработку персональных данных',
      content: LEGAL_PERSONAL_DATA_CONSENT_TEXT,
      currentVersion: '2.1',
      effectiveAt: today,
      requiresConsent: true,
      required: true,
      versionHistory: [
        {
          version: '2.1',
          effectiveAt: today,
          changeSummary: 'Сервисные уведомления и чат-вложения в цель service.',
        },
      ],
    },
    {
      type: 'terms_of_service',
      purpose: 'service',
      title: 'Пользовательское соглашение',
      content: LEGAL_TERMS_OF_SERVICE_TEXT,
      currentVersion: '3.0',
      effectiveAt: today,
      requiresConsent: true,
      required: true,
      versionHistory: [
        {
          version: '3.0',
          effectiveAt: today,
          changeSummary: 'Раздел «Пользовательский контент»: гарантии, жалобы, 3 раб. дня.',
        },
      ],
    },
    {
      type: 'school_rules',
      purpose: '',
      title: 'Правила школы',
      content: LEGAL_SCHOOL_RULES_TEXT,
      currentVersion: '2.1',
      effectiveAt: today,
      requiresConsent: false,
      required: false,
      versionHistory: [
        {
          version: '2.1',
          effectiveAt: today,
          changeSummary: 'Публикация вне чатов — отдельно через администрацию Школы.',
        },
      ],
    },
    {
      type: 'personal_data',
      purpose: 'minor_guardian',
      title: 'Согласие законного представителя',
      content: LEGAL_GUARDIAN_CONSENT_TEXT,
      currentVersion: '2.1',
      effectiveAt: today,
      requiresConsent: true,
      required: false,
      versionHistory: [
        {
          version: '2.1',
          effectiveAt: today,
          changeSummary: 'Без optional-согласий communication/publication в PWA.',
        },
      ],
    },
  ];
}

function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function documentFilter(doc: SeedLegalDoc): string {
  const type = escapeFilterValue(doc.type);
  if (doc.purpose) {
    return `type = "${type}" && purpose = "${escapeFilterValue(doc.purpose)}"`;
  }
  return `type = "${type}" && (purpose = "" || purpose = null)`;
}

export interface EnsureLegalResult {
  created: number;
  updated: number;
}

/** Create missing / refresh content of consent documents. */
export async function ensureLegalDocuments(client: PbClient): Promise<EnsureLegalResult> {
  let created = 0;
  let updated = 0;

  for (const doc of buildLegalDocuments()) {
    const existing = await client.listRecords('legal_documents', {
      filter: documentFilter(doc),
      perPage: 1,
    });
    const body: Record<string, unknown> = {
      type: doc.type,
      title: doc.title,
      content: doc.content,
      currentVersion: doc.currentVersion,
      effectiveAt: doc.effectiveAt,
      purpose: doc.purpose,
      versionHistory: doc.versionHistory,
      // Migration 1792400000 makes requiresConsent optional — false is safe.
      requiresConsent: doc.requiresConsent === true,
      required: doc.required === true,
    };

    if (existing[0]?.id) {
      await client.updateRecord('legal_documents', existing[0].id, body);
      updated += 1;
    } else {
      await client.createRecord('legal_documents', body);
      created += 1;
    }
  }

  return { created, updated };
}
