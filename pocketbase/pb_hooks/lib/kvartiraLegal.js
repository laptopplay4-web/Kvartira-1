/// @ts-check
/**
 * ROADMAP 2.8 — legal document + consent hooks.
 * User creates own consent; document metadata synced from legal_documents.
 * Admin updates lock document type.
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
function relId(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value) {
    return String(value.id);
  }
  return '';
}

function isUsersAuth(auth) {
  if (!auth) return false;
  try {
    return auth.collection().name === 'users';
  } catch (_) {
    return false;
  }
}

/**
 * @param {core.App} app
 * @param {core.RecordRequestEvent} e
 */
function assertConsentCreate(app, e) {
  const auth = e.auth;
  if (!auth) {
    throw new ApiError(403, 'Нет доступа');
  }

  if (isUsersAuth(auth) && auth.getString('role') !== 'admin') {
    e.record.set('user', auth.id);
  }

  const documentId = relId(e.record.get('document'));
  if (!documentId) {
    throw new ApiError(400, 'Укажите документ');
  }

  let document;
  try {
    document = app.findRecordById('legal_documents', documentId);
  } catch {
    throw new ApiError(404, 'Документ не найден');
  }

  if (!document.getBool('requiresConsent')) {
    throw new ApiError(400, 'Документ не требует согласия');
  }

  e.record.set('documentType', document.getString('type'));
  e.record.set('documentTitle', document.getString('title'));
  e.record.set('version', document.getString('currentVersion'));
  e.record.set('acceptedAt', new Date().toISOString());
}

/**
 * @param {core.App} _app
 * @param {core.RecordRequestEvent} e
 */
function assertLegalDocumentUpdate(_app, e) {
  const auth = e.auth;
  if (!auth || auth.getString('role') !== 'admin') {
    throw new ApiError(403, 'Нет прав на управление документами');
  }

  const original = typeof e.record.original === 'function' ? e.record.original() : e.record;
  e.record.set('type', original.getString('type'));
}

module.exports = {
  assertConsentCreate,
  assertLegalDocumentUpdate,
  relId,
};
