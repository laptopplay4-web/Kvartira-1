import type { ConsentPurpose, LegalDocument, UserConsent } from '@/types';
import { CONSENT_ADULT_AGE, isRequiredConsentPurpose } from '@/services/legal/constants';

export function sortDocumentsByType(documents: LegalDocument[]): LegalDocument[] {
  const order: LegalDocument['type'][] = [
    'privacy_policy',
    'personal_data',
    'terms_of_service',
    'school_rules',
  ];
  return [...documents].sort(
    (a, b) => order.indexOf(a.type) - order.indexOf(b.type),
  );
}

export function sortConsentsByDate(consents: UserConsent[]): UserConsent[] {
  return [...consents].sort((a, b) => b.acceptedAt.localeCompare(a.acceptedAt));
}

export function isConsentActive(consent: UserConsent): boolean {
  return !consent.revokedAt;
}

export function getUserConsentForDocument(
  consents: UserConsent[],
  documentId: string,
): UserConsent | undefined {
  return consents
    .filter((c) => c.documentId === documentId)
    .sort((a, b) => b.acceptedAt.localeCompare(a.acceptedAt))[0];
}

/** Latest consent that has not been withdrawn. */
export function getActiveConsentForDocument(
  consents: UserConsent[],
  documentId: string,
): UserConsent | undefined {
  return consents
    .filter((c) => c.documentId === documentId && isConsentActive(c))
    .sort((a, b) => b.acceptedAt.localeCompare(a.acceptedAt))[0];
}

export function hasCurrentConsent(
  consents: UserConsent[],
  document: LegalDocument,
): boolean {
  if (!document.requiresConsent) return true;
  const latest = getActiveConsentForDocument(consents, document.id);
  return latest?.version === document.currentVersion;
}

/**
 * Documents still waiting for a signature. Optional purposes are excluded: a
 * declined mailing consent is a valid answer, not an outstanding task. The
 * guardian consent is collected at registration for minors only.
 */
export function getPendingConsents(
  documents: LegalDocument[],
  consents: UserConsent[],
): LegalDocument[] {
  const required = new Set(getRequiredConsentDocuments(documents).map((doc) => doc.id));
  return documents.filter(
    (doc) => required.has(doc.id) && !hasCurrentConsent(consents, doc),
  );
}

export function countPendingConsents(
  documents: LegalDocument[],
  consents: UserConsent[],
): number {
  return getPendingConsents(documents, consents).length;
}

/** Documents a person must accept before the account works at all. */
export function getRequiredConsentDocuments(documents: LegalDocument[]): LegalDocument[] {
  return sortDocumentsByType(
    documents.filter((doc) => {
      if (!doc.requiresConsent) return false;
      if (doc.purpose === 'minor_guardian') return false;
      // Prefer purpose: service docs are always required (ignore bad `required: false` from PB).
      if (isRequiredConsentPurpose(doc.purpose)) return true;
      return doc.required === true;
    }),
  );
}

/**
 * Required checkboxes on `/register`: ПДн + оферта + политика.
 * Falls back by document `type` when purpose/required metadata is missing (PB).
 */
export function getRegistrationRequiredDocuments(
  documents: LegalDocument[],
): LegalDocument[] {
  const fromFlags = getRequiredConsentDocuments(documents);
  if (fromFlags.length > 0) return fromFlags;

  const pick = (predicate: (doc: LegalDocument) => boolean) =>
    documents.find((doc) => doc.requiresConsent && predicate(doc));

  const personalData =
    pick((d) => d.type === 'personal_data' && d.purpose === 'service') ??
    pick(
      (d) =>
        d.type === 'personal_data' &&
        d.purpose !== 'communication' &&
        d.purpose !== 'publication' &&
        d.purpose !== 'minor_guardian',
    );

  const terms = pick((d) => d.type === 'terms_of_service');
  const privacy = pick((d) => d.type === 'privacy_policy');

  return [personalData, terms, privacy].filter((doc): doc is LegalDocument => !!doc);
}

/** Labels for registration checkboxes (152-ФЗ wording). */
export function getRegistrationConsentTitle(document: LegalDocument): string {
  if (
    document.type === 'personal_data' &&
    document.purpose !== 'communication' &&
    document.purpose !== 'publication' &&
    document.purpose !== 'minor_guardian'
  ) {
    return 'Согласие на обработку персональных данных';
  }
  if (document.type === 'terms_of_service') {
    return 'Согласие с пользовательским соглашением';
  }
  return document.title;
}

/** Documents a person may decline and still use the app — none in current model. */
export function getOptionalConsentDocuments(_documents: LegalDocument[]): LegalDocument[] {
  return [];
}

export function getGuardianConsentDocument(
  documents: LegalDocument[],
): LegalDocument | undefined {
  return documents.find((doc) => doc.purpose === 'minor_guardian');
}

export function getDocumentsForPurpose(
  documents: LegalDocument[],
  purpose: ConsentPurpose,
): LegalDocument[] {
  return documents.filter((doc) => doc.purpose === purpose);
}

/** Whole years between `birthDate` (ISO yyyy-mm-dd) and `now`. */
export function calculateAge(birthDate: string, now = new Date()): number | null {
  const parsed = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  let age = now.getFullYear() - parsed.getFullYear();
  const monthDiff = now.getMonth() - parsed.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < parsed.getDate())) age -= 1;
  return age;
}

export function isMinor(birthDate: string, now = new Date()): boolean {
  const age = calculateAge(birthDate, now);
  return age !== null && age < CONSENT_ADULT_AGE;
}

export function bumpLegalVersion(current: string): string {
  const [majorPart, minorPart] = current.split('.');
  const major = Number.parseInt(majorPart ?? '1', 10);
  const minor = Number.parseInt(minorPart ?? '0', 10);
  return `${Number.isNaN(major) ? 1 : major}.${(Number.isNaN(minor) ? 0 : minor) + 1}`;
}
