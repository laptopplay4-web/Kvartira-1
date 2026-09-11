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
    documents.filter(
      (doc) => doc.requiresConsent && (doc.required ?? isRequiredConsentPurpose(doc.purpose)),
    ),
  );
}

/** Documents a person may decline and still use the app. */
export function getOptionalConsentDocuments(documents: LegalDocument[]): LegalDocument[] {
  const required = new Set(getRequiredConsentDocuments(documents).map((doc) => doc.id));
  return sortDocumentsByType(
    documents.filter(
      (doc) =>
        doc.requiresConsent && !required.has(doc.id) && doc.purpose !== 'minor_guardian',
    ),
  );
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
