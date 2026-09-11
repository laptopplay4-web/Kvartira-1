import { ClientResponseError } from 'pocketbase';
import type {
  AcceptConsentOptions,
  LegalApi,
  PublishLegalVersionInput,
  UpdateLegalDocumentInput,
} from '@/services/api/types';
import { ApiError } from '@/services/api/types';
import { getPocketBase } from '@/services/api/pocketbase/client';
import { withPbError } from '@/services/api/pocketbase/errors';
import { escapePbFilter } from '@/services/api/pocketbase/helpers';
import {
  mapLegalDocumentRecord,
  mapUserConsentRecord,
  mapUserRecord,
  type PbUserConsentRecord,
} from '@/services/api/pocketbase/mappers';
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
import type { LegalDocument, User, UserConsent } from '@/types';

async function getRequesterUser(userId: string): Promise<User> {
  const pb = getPocketBase();
  try {
    const record = await pb.collection('users').getOne(userId);
    return mapUserRecord(record);
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      throw new ApiError('Пользователь не найден', 'NOT_FOUND', 404);
    }
    throw error;
  }
}

async function loadDocumentOrThrow(id: string): Promise<LegalDocument> {
  const pb = getPocketBase();
  try {
    const record = await pb.collection('legal_documents').getOne(id);
    return mapLegalDocumentRecord(record);
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      throw new ApiError('Документ не найден', 'NOT_FOUND', 404);
    }
    throw error;
  }
}

function assertViewConsents(requesterId: string, user: User): void {
  if (!canViewOwnConsents(user, requesterId)) {
    throw new ApiError('Нет доступа к согласиям', 'FORBIDDEN', 403);
  }
}

function assertAcceptAccess(requesterId: string, user: User): void {
  if (!canAcceptDocument(user, requesterId)) {
    throw new ApiError('Нет прав на принятие документов', 'FORBIDDEN', 403);
  }
}

function assertManageAccess(user: User): void {
  if (!canManageLegalDocuments(user)) {
    throw new ApiError('Нет прав на управление документами', 'FORBIDDEN', 403);
  }
}

async function createConsentRecord(
  document: LegalDocument,
  requesterId: string,
  options?: AcceptConsentOptions,
): Promise<UserConsent> {
  if (document.purpose === 'minor_guardian' && !options?.guardian) {
    throw new ApiError('Укажите данные законного представителя', 'VALIDATION_ERROR', 400);
  }

  const pb = getPocketBase();
  const now = new Date().toISOString();
  // documentType / version / purpose / ipAddress / userAgent are overwritten by
  // the PB hook — sending them here only keeps the optimistic value readable.
  const record = await pb.collection('user_consents').create({
    user: requesterId,
    document: document.id,
    documentType: document.type,
    documentTitle: document.title,
    version: document.currentVersion,
    purpose: document.purpose ?? '',
    guardian: document.purpose === 'minor_guardian' ? options?.guardian : null,
    acceptedAt: now,
  });
  return mapUserConsentRecord(record);
}

export const pocketbaseLegalApi: LegalApi = {
  async getDocuments() {
    return withPbError(async () => {
      const pb = getPocketBase();
      const records = await pb.collection('legal_documents').getFullList();
      return sortDocumentsByType(records.map(mapLegalDocumentRecord));
    });
  },

  async getDocument(id) {
    return withPbError(async () => loadDocumentOrThrow(id));
  },

  async getUserConsents(requesterId) {
    return withPbError(async () => {
      const user = await getRequesterUser(requesterId);
      assertViewConsents(requesterId, user);

      const pb = getPocketBase();
      const records = await pb.collection('user_consents').getFullList({
        filter: `user = "${escapePbFilter(requesterId)}"`,
        sort: '-acceptedAt',
      });
      return sortConsentsByDate(records.map(mapUserConsentRecord));
    });
  },

  async getPendingConsents(requesterId) {
    return withPbError(async () => {
      const user = await getRequesterUser(requesterId);
      assertViewConsents(requesterId, user);

      const [documents, consents] = await Promise.all([
        pocketbaseLegalApi.getDocuments(),
        pocketbaseLegalApi.getUserConsents(requesterId),
      ]);
      return getPendingConsents(documents, consents);
    });
  },

  async acceptDocument(documentId, requesterId, options) {
    return withPbError(async () => {
      const user = await getRequesterUser(requesterId);
      assertAcceptAccess(requesterId, user);

      const document = await loadDocumentOrThrow(documentId);
      if (!document.requiresConsent) {
        throw new ApiError('Документ не требует согласия', 'VALIDATION_ERROR', 400);
      }

      return createConsentRecord(document, requesterId, options);
    });
  },

  async acceptDocuments(documentIds, requesterId, options) {
    return withPbError(async () => {
      const user = await getRequesterUser(requesterId);
      assertAcceptAccess(requesterId, user);

      const results: UserConsent[] = [];
      for (const documentId of documentIds) {
        const document = await loadDocumentOrThrow(documentId);
        if (!document.requiresConsent) continue;
        results.push(await createConsentRecord(document, requesterId, options));
      }
      return results;
    });
  },

  async revokeConsent(consentId, requesterId) {
    return withPbError(async () => {
      const user = await getRequesterUser(requesterId);
      assertViewConsents(requesterId, user);

      // The timestamp is stamped server-side: `user_consents` is not directly
      // updatable, the consent journal only moves through this endpoint.
      const pb = getPocketBase();
      const record = await pb.send('/api/kvartira/consents/revoke', {
        method: 'POST',
        body: { consentId },
      });
      return mapUserConsentRecord(record as PbUserConsentRecord);
    });
  },

  async canManageDocuments(requesterId) {
    return withPbError(async () => {
      const user = await getRequesterUser(requesterId);
      return canManageLegalDocuments(user);
    });
  },

  async updateDocument(id, input: UpdateLegalDocumentInput, adminId) {
    return withPbError(async () => {
      const admin = await getRequesterUser(adminId);
      assertManageAccess(admin);
      validateUpdateLegalDocumentInput(input);

      const existing = await loadDocumentOrThrow(id);
      const body: Record<string, unknown> = {};

      if (input.title !== undefined) body.title = input.title.trim();
      if (input.content !== undefined) body.content = input.content.trim();
      if (input.requiresConsent !== undefined) body.requiresConsent = input.requiresConsent;
      if (input.purpose !== undefined) body.purpose = input.purpose ?? '';
      if (input.required !== undefined) body.required = input.required;

      if (Object.keys(body).length === 0) return existing;

      const pb = getPocketBase();
      const record = await pb.collection('legal_documents').update(id, body);
      return mapLegalDocumentRecord(record);
    });
  },

  async publishVersion(id, input: PublishLegalVersionInput, adminId) {
    return withPbError(async () => {
      const admin = await getRequesterUser(adminId);
      assertManageAccess(admin);
      validatePublishLegalVersionInput(input);

      const document = await loadDocumentOrThrow(id);
      const nextVersion = input.version?.trim() || bumpLegalVersion(document.currentVersion);
      if (nextVersion === document.currentVersion) {
        throw new ApiError('Новая версия должна отличаться от текущей', 'VALIDATION', 400);
      }

      const effectiveAt = input.effectiveAt.trim();
      const changeSummary = input.changeSummary.trim();
      const content = input.content.trim();

      const versionHistory = [
        { version: nextVersion, effectiveAt, changeSummary },
        ...document.versionHistory.filter((entry) => entry.version !== nextVersion),
      ];

      const pb = getPocketBase();
      const record = await pb.collection('legal_documents').update(id, {
        currentVersion: nextVersion,
        effectiveAt,
        content,
        versionHistory,
      });

      return mapLegalDocumentRecord(record);
    });
  },
};
