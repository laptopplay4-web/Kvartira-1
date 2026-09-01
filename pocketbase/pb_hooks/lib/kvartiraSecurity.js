/// @ts-check
/**
 * ROADMAP 2.9 — security session + alert hooks.
 * Mirrors mock security behavior in src/services/api/mock/security.ts.
 */

const auth = require(`${__hooks}/lib/kvartiraAuth.js`);

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
 * @param {import('pocketbase').PocketBase} app
 * @param {string} userId
 */
function clearCurrentSessions(app, userId) {
  /** @type {Record[]} */
  const rows = [];
  app.findRecordsByFilter(
    'security_sessions',
    'user = {:userId} && isCurrent = true',
    '',
    200,
    0,
    { userId },
    rows,
  );
  for (const row of rows) {
    row.set('isCurrent', false);
    app.save(row);
  }
}

/**
 * @param {import('pocketbase').PocketBase} app
 * @param {string} userId
 * @param {{ request?: { header?: { get: (name: string) => string } } }} e
 */
function recordSecuritySession(app, userId, e) {
  const deviceLabel = auth.getDeviceLabel(e);
  const ipAddress = auth.getClientIp(e);
  const now = new Date().toISOString();

  /** @type {Record[]} */
  const existingRows = [];
  app.findRecordsByFilter(
    'security_sessions',
    'user = {:userId} && deviceLabel = {:deviceLabel}',
    '',
    1,
    0,
    { userId, deviceLabel },
    existingRows,
  );

  clearCurrentSessions(app, userId);

  const sessionsCol = app.findCollectionByNameOrId('security_sessions');

  if (existingRows.length > 0) {
    const session = existingRows[0];
    session.set('lastActiveAt', now);
    session.set('ipAddress', ipAddress);
    session.set('isCurrent', true);
    app.save(session);
    return;
  }

  const session = new Record(sessionsCol);
  session.set('user', userId);
  session.set('deviceLabel', deviceLabel);
  session.set('platform', 'web');
  session.set('ipAddress', ipAddress);
  session.set('lastActiveAt', now);
  session.set('isCurrent', true);
  app.save(session);

  auth.pushSecurityAlert(
    app,
    userId,
    'new_device',
    'Вход с нового устройства',
    `Обнаружен вход с ${deviceLabel}.`,
  );
}

/**
 * @param {core.RecordRequestEvent} e
 */
function assertSecuritySessionCreate(e) {
  const authRecord = e.auth;
  if (!authRecord) {
    throw new ApiError(403, 'Нет доступа');
  }

  if (authRecord.getString('role') !== 'admin') {
    e.record.set('user', authRecord.id);
  }

  const userId = relId(e.record.get('user'));
  if (userId !== authRecord.id && authRecord.getString('role') !== 'admin') {
    throw new ApiError(403, 'Нет доступа');
  }
}

/**
 * @param {core.RecordRequestEvent} e
 */
function assertSecuritySessionUpdate(e) {
  const authRecord = e.auth;
  if (!authRecord) {
    throw new ApiError(403, 'Нет доступа');
  }

  const original = typeof e.record.original === 'function' ? e.record.original() : e.record;
  e.record.set('user', original.get('user'));

  const userId = relId(original.get('user'));
  if (userId !== authRecord.id && authRecord.getString('role') !== 'admin') {
    throw new ApiError(403, 'Нет доступа');
  }
}

/**
 * @param {core.RecordRequestEvent} e
 */
function assertSecurityAlertUpdate(e) {
  const authRecord = e.auth;
  if (!authRecord) {
    throw new ApiError(403, 'Нет доступа');
  }

  const original = typeof e.record.original === 'function' ? e.record.original() : e.record;
  e.record.set('user', original.get('user'));
  e.record.set('type', original.get('type'));
  e.record.set('title', original.get('title'));
  e.record.set('message', original.get('message'));
}

module.exports = {
  relId,
  recordSecuritySession,
  assertSecuritySessionCreate,
  assertSecuritySessionUpdate,
  assertSecurityAlertUpdate,
};
