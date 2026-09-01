import type { LegalDocument, UserConsent } from '@/types';

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

export function getUserConsentForDocument(
  consents: UserConsent[],
  documentId: string,
): UserConsent | undefined {
  return consents
    .filter((c) => c.documentId === documentId)
    .sort((a, b) => b.acceptedAt.localeCompare(a.acceptedAt))[0];
}

export function hasCurrentConsent(
  consents: UserConsent[],
  document: LegalDocument,
): boolean {
  if (!document.requiresConsent) return true;
  const latest = getUserConsentForDocument(consents, document.id);
  return latest?.version === document.currentVersion;
}

export function getPendingConsents(
  documents: LegalDocument[],
  consents: UserConsent[],
): LegalDocument[] {
  return documents.filter((doc) => doc.requiresConsent && !hasCurrentConsent(consents, doc));
}

export function countPendingConsents(
  documents: LegalDocument[],
  consents: UserConsent[],
): number {
  return getPendingConsents(documents, consents).length;
}

export function bumpLegalVersion(current: string): string {
  const [majorPart, minorPart] = current.split('.');
  const major = Number.parseInt(majorPart ?? '1', 10);
  const minor = Number.parseInt(minorPart ?? '0', 10);
  return `${Number.isNaN(major) ? 1 : major}.${(Number.isNaN(minor) ? 0 : minor) + 1}`;
}
