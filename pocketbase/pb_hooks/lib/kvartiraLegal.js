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

  const purpose = document.getString('purpose');

  e.record.set('documentType', document.getString('type'));
  e.record.set('documentTitle', document.getString('title'));
  e.record.set('version', document.getString('currentVersion'));
  e.record.set('purpose', purpose);
  e.record.set('guardian', purpose === 'minor_guardian' ? guardianOf(e.record) : null);
  e.record.set('consentTextVersion', document.getString('currentVersion'));
  e.record.set('acceptedAt', new Date().toISOString());

  // Proof of consent must come from the request, not from the request body —
  // otherwise the journal records whatever the client felt like claiming.
  e.record.set('ipAddress', clientIp(e));
  e.record.set('userAgent', userAgent(e).slice(0, 512));

  // A brand new consent is never already withdrawn.
  e.record.set('revokedAt', '');
}

/**
 * Legal representative details, trimmed to what the consent journal needs.
 * Anything else the client sends along is dropped.
 *
 * @param {core.Record} record
 * @returns {{ fullName: string, phone: string, relation: string } | null}
 */
function guardianOf(record) {
  const raw = record.get('guardian');
  const value = typeof raw === 'string' ? safeParse(raw) : raw;
  if (!value || typeof value !== 'object') return null;

  const fullName = String(value.fullName || '').trim().slice(0, 120);
  const phone = String(value.phone || '').trim().slice(0, 20);
  if (!fullName || !phone) return null;

  return {
    fullName,
    phone,
    relation: String(value.relation || '').trim().slice(0, 60),
  };
}

/**
 * @param {string} raw
 * @returns {any}
 */
function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

/**
 * @param {any} e
 * @returns {{ headers?: Record<string, string>, remoteIP?: string } | null}
 */
function requestInfoSafe(e) {
  try {
    return typeof e.requestInfo === 'function' ? e.requestInfo() || null : null;
  } catch (_) {
    return null;
  }
}

/**
 * @param {any} e
 * @returns {string}
 */
function clientIp(e) {
  const info = requestInfoSafe(e);
  if (info && info.remoteIP) return String(info.remoteIP);
  try {
    if (typeof e.realIP === 'function') return String(e.realIP() || '');
  } catch (_) {
    /* ignore */
  }
  return '';
}

/**
 * @param {any} e
 * @returns {string}
 */
function userAgent(e) {
  const info = requestInfoSafe(e);
  const headers = (info && info.headers) || {};
  return String(headers['user-agent'] || headers['User-Agent'] || '');
}

/**
 * Withdraw a consent (152-ФЗ, ст. 9 ч. 2).
 *
 * Rows are stamped, never deleted — the consent journal has to stay intact and
 * show both when consent was given and when it was withdrawn.
 *
 * @param {core.App} app
 * @param {any} e
 * @param {string} consentId
 * @returns {core.Record}
 */
function revokeConsentRecord(app, e, consentId) {
  const info = requestInfoSafe(e);
  const auth = info && info.auth;
  if (!auth || !isUsersAuth(auth)) {
    throw new ApiError(403, 'Нет доступа');
  }

  let consent;
  try {
    consent = app.findRecordById('user_consents', consentId);
  } catch (_) {
    throw new ApiError(404, 'Согласие не найдено');
  }

  const ownerId = relId(consent.get('user'));
  const isAdmin = auth.getString('role') === 'admin';
  if (ownerId !== auth.id && !isAdmin) {
    throw new ApiError(403, 'Нет доступа');
  }

  if (consent.getString('revokedAt')) {
    return consent;
  }

  // Service consent cannot be withdrawn while keeping the account: withdrawing
  // it means processing must stop entirely, which is account deletion.
  if (consent.getString('purpose') === 'service') {
    throw new ApiError(
      400,
      'Это согласие нельзя отозвать отдельно — без него аккаунт не работает. Удалите аккаунт в настройках.',
    );
  }

  consent.set('revokedAt', new Date().toISOString());
  app.save(consent);

  return consent;
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
  revokeConsentRecord,
  clientIp,
  userAgent,
  relId,
};
