/// @ts-check
/**
 * Audit journal for personal-data events (152-ФЗ).
 *
 * The operator has to be able to show, for any subject, when consent was given,
 * when it was withdrawn and when the data was erased — together with the real
 * IP and User-Agent of the request. Client-supplied values are never trusted,
 * so everything here is read from the request on the server.
 *
 * `audit_logs` has `createRule: null`: nothing outside these hooks can write to
 * it, and `app.save()` from a hook bypasses API rules by design.
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

/**
 * @param {any} e
 * @returns {{ headers?: Record<string, string>, remoteIP?: string, auth?: any } | null}
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
 * @returns {{ ip: string, userAgent: string, actorId: string }}
 */
function requestContext(e) {
  const info = requestInfoSafe(e);
  const headers = (info && info.headers) || {};
  const auth = (info && info.auth) || (e && e.auth) || null;

  let ip = info && info.remoteIP ? String(info.remoteIP) : '';
  if (!ip) {
    try {
      ip = typeof e.realIP === 'function' ? String(e.realIP() || '') : '';
    } catch (_) {
      ip = '';
    }
  }

  return {
    ip,
    userAgent: String(headers['user-agent'] || headers['User-Agent'] || '').slice(0, 512),
    actorId: auth ? String(auth.id || '') : '',
  };
}

/**
 * @param {core.App} app
 * @param {any} e
 * @param {string} action
 * @param {string} entityType
 * @param {string} entityId
 * @param {Record<string, unknown>} [metadata]
 */
function writeAuditLog(app, e, action, entityType, entityId, metadata) {
  try {
    const context = requestContext(e);
    const collection = app.findCollectionByNameOrId('audit_logs');
    const record = new Record(collection);

    if (context.actorId) record.set('actor', context.actorId);
    record.set('action', action);
    record.set('entityType', entityType);
    record.set('entityId', entityId);
    record.set('metadata', {
      ...(metadata || {}),
      ipAddress: context.ip,
      userAgent: context.userAgent,
      at: new Date().toISOString(),
    });

    app.save(record);
  } catch (_) {
    // An audit write must never break the operation it is describing.
  }
}

/**
 * @param {core.App} app
 * @param {any} e
 * @param {'consent.accepted' | 'consent.revoked'} action
 * @param {core.Record} consent
 */
function logConsentEvent(app, e, action, consent) {
  writeAuditLog(app, e, action, 'user_consents', consent.id, {
    subjectId: relId(consent.get('user')),
    documentId: relId(consent.get('document')),
    documentType: consent.getString('documentType'),
    purpose: consent.getString('purpose'),
    version: consent.getString('version'),
  });
}

/**
 * @param {core.App} app
 * @param {any} e
 * @param {string} userId
 * @param {'self' | 'admin'} initiator
 */
function logAccountDeletion(app, e, userId, initiator) {
  writeAuditLog(app, e, 'account.deleted', 'users', userId, { initiator });
}

/**
 * @param {core.App} app
 * @param {any} e
 * @param {string} userId
 */
function logDataExport(app, e, userId) {
  writeAuditLog(app, e, 'account.data_exported', 'users', userId, {});
}

module.exports = {
  requestContext,
  writeAuditLog,
  logConsentEvent,
  logAccountDeletion,
  logDataExport,
};
