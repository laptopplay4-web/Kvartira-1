import type { LegalDocument, User, UserConsent } from '@/types';
import {
  canAcceptDocument,
  canManageLegalDocuments,
  canViewOwnConsents,
} from '@/services/legal/access';
import {
  bumpLegalVersion,
  getPendingConsents,
  sortConsentsByDate,
  sortDocumentsByType,
} from '@/services/legal/helpers';
import {
  validatePublishLegalVersionInput,
  validateUpdateLegalDocumentInput,
} from '@/services/legal/validation';
import type { PublishLegalVersionInput, UpdateLegalDocumentInput } from '@/services/api/types';
import { ApiError } from '@/services/api/types';
import type { LegalApi } from '@/services/api/types';

export interface MockLegalDb {
  users: User[];
  legalDocuments: LegalDocument[];
  userConsents: UserConsent[];
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createMockLegalApi(
  db: MockLegalDb,
  delay: (ms?: number) => Promise<void>,
): LegalApi {
  function getUserById(userId: string): User {
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new ApiError('Пользователь не найден', 'NOT_FOUND', 404);
    return user;
  }

  function getDocumentById(id: string): LegalDocument {
    const doc = db.legalDocuments.find((d) => d.id === id);
    if (!doc) throw new ApiError('Документ не найден', 'NOT_FOUND', 404);
    return doc;
  }

  function assertViewConsents(requesterId: string): User {
    const user = getUserById(requesterId);
    if (!canViewOwnConsents(user, requesterId)) {
      throw new ApiError('Нет доступа к согласиям', 'FORBIDDEN', 403);
    }
    return user;
  }

  function assertAcceptAccess(requesterId: string): User {
    const user = getUserById(requesterId);
    if (!canAcceptDocument(user, requesterId)) {
      throw new ApiError('Нет прав на принятие документов', 'FORBIDDEN', 403);
    }
    return user;
  }

  function assertManageAccess(adminId: string): User {
    const user = getUserById(adminId);
    if (!canManageLegalDocuments(user)) {
      throw new ApiError('Нет прав на управление документами', 'FORBIDDEN', 403);
    }
    return user;
  }

  return {
    async getDocuments() {
      await delay();
      return sortDocumentsByType(db.legalDocuments);
    },

    async getDocument(id) {
      await delay();
      return getDocumentById(id);
    },

    async getUserConsents(requesterId) {
      await delay();
      assertViewConsents(requesterId);
      return sortConsentsByDate(
        db.userConsents.filter((c) => c.userId === requesterId),
      );
    },

    async getPendingConsents(requesterId) {
      await delay();
      assertViewConsents(requesterId);
      const consents = db.userConsents.filter((c) => c.userId === requesterId);
      return getPendingConsents(db.legalDocuments, consents);
    },

    async acceptDocument(documentId, requesterId) {
      await delay(80);
      assertAcceptAccess(requesterId);
      const document = getDocumentById(documentId);
      if (!document.requiresConsent) {
        throw new ApiError('Документ не требует согласия', 'VALIDATION_ERROR', 400);
      }

      const consent: UserConsent = {
        id: uid('consent'),
        userId: requesterId,
        documentId: document.id,
        documentType: document.type,
        documentTitle: document.title,
        version: document.currentVersion,
        acceptedAt: new Date().toISOString(),
      };
      db.userConsents.push(consent);
      return consent;
    },

    async acceptDocuments(documentIds, requesterId) {
      await delay(100);
      assertAcceptAccess(requesterId);
      const results: UserConsent[] = [];
      for (const documentId of documentIds) {
        const document = getDocumentById(documentId);
        if (!document.requiresConsent) continue;
        const consent: UserConsent = {
          id: uid('consent'),
          userId: requesterId,
          documentId: document.id,
          documentType: document.type,
          documentTitle: document.title,
          version: document.currentVersion,
          acceptedAt: new Date().toISOString(),
        };
        db.userConsents.push(consent);
        results.push(consent);
      }
      return results;
    },

    async canManageDocuments(requesterId) {
      await delay(50);
      const user = getUserById(requesterId);
      return canManageLegalDocuments(user);
    },

    async updateDocument(id, input: UpdateLegalDocumentInput, adminId) {
      await delay(80);
      assertManageAccess(adminId);
      validateUpdateLegalDocumentInput(input);
      const document = getDocumentById(id);

      if (input.title !== undefined) document.title = input.title.trim();
      if (input.content !== undefined) document.content = input.content.trim();
      if (input.requiresConsent !== undefined) document.requiresConsent = input.requiresConsent;

      return document;
    },

    async publishVersion(id, input: PublishLegalVersionInput, adminId) {
      await delay(100);
      assertManageAccess(adminId);
      validatePublishLegalVersionInput(input);
      const document = getDocumentById(id);

      const nextVersion = input.version?.trim() || bumpLegalVersion(document.currentVersion);
      if (nextVersion === document.currentVersion) {
        throw new ApiError('Новая версия должна отличаться от текущей', 'VALIDATION', 400);
      }

      const effectiveAt = input.effectiveAt.trim();
      const changeSummary = input.changeSummary.trim();
      const content = input.content.trim();

      document.versionHistory = [
        {
          version: nextVersion,
          effectiveAt,
          changeSummary,
        },
        ...document.versionHistory.filter((entry) => entry.version !== nextVersion),
      ];
      document.currentVersion = nextVersion;
      document.effectiveAt = effectiveAt;
      document.content = content;

      return document;
    },
  };
}
