/// @ts-check
/**
 * ROADMAP 2.9 — security session + alert hooks.
 * Mirrors mock security behavior in src/services/api/mock/security.ts.
 *
 * Multi-device: each password login creates a new security_sessions row.
 * tokenFingerprint (SHA-256 of JWT) identifies the viewing device as current.
 */

const auth = require(`${__hooks}/lib/kvartiraAuth.js`);

const MAX_SECURITY_SESSIONS = 20;

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
 * @param {unknown} token
 * @returns {string}
 */
function fingerprintToken(token) {
  if (typeof token !== 'string' || !token.trim()) return '';
  try {
    return String($security.sha256(token.trim()));
  } catch (_) {
    return '';
  }
}

/**
 * PocketBase JSVM may not persist bool `false` on optional fields — clear via null.
 * @param {import('pocketbase').PocketBase} app
 * @param {string} userId
 * @param {string} currentSessionId
 */
function markOnlyCurrentSession(app, userId, currentSessionId) {
  /** @type {Record[]} */
  let rows = [];
  try {
    rows =
      app.findRecordsByFilter(
        'security_sessions',
        'user = {:userId}',
        '',
        200,
        0,
        { userId },
      ) || [];
  } catch (_) {
    return;
  }

  for (const row of rows) {
    const shouldBeCurrent = row.id === currentSessionId;
    const wasCurrent = row.getBool('isCurrent');

    if (shouldBeCurrent) {
      if (!wasCurrent) {
        row.set('isCurrent', true);
        try {
          app.save(row);
        } catch (_) {
          /* ignore */
        }
      }
      continue;
    }

    if (wasCurrent) {
      row.set('isCurrent', null);
      try {
        app.save(row);
      } catch (_) {
        /* required bool false-as-blank on older schemas */
      }
    }
  }
}

/**
 * @param {import('pocketbase').PocketBase} app
 * @param {string} userId
 */
function trimSecuritySessions(app, userId) {
  /** @type {Record[]} */
  let rows = [];
  try {
    rows =
      app.findRecordsByFilter(
        'security_sessions',
        'user = {:userId}',
        '-lastActiveAt',
        MAX_SECURITY_SESSIONS + 10,
        0,
        { userId },
      ) || [];
  } catch (_) {
    return;
  }

  for (let i = MAX_SECURITY_SESSIONS; i < rows.length; i++) {
    try {
      app.delete(rows[i]);
    } catch (_) {
      /* ignore */
    }
  }
}

/**
 * @param {import('pocketbase').PocketBase} app
 * @param {string} userId
 * @param {{ token?: string, request?: { header?: { get: (name: string) => string } } }} e
 */
function recordSecuritySession(app, userId, e) {
  const deviceLabel = auth.getDeviceLabel(e);
  const ipAddress = auth.getClientIp(e);
  const now = new Date().toISOString();
  const tokenFingerprint = fingerprintToken(e && e.token);

  const sessionsCol = app.findCollectionByNameOrId('security_sessions');
  const session = new Record(sessionsCol);
  session.set('user', userId);
  session.set('deviceLabel', deviceLabel);
  session.set('platform', 'web');
  session.set('ipAddress', ipAddress);
  session.set('lastActiveAt', now);
  session.set('isCurrent', true);
  if (tokenFingerprint) {
    session.set('tokenFingerprint', tokenFingerprint);
  }
  app.save(session);

  markOnlyCurrentSession(app, userId, session.id);
  trimSecuritySessions(app, userId);

  const notifications = require(`${__hooks}/lib/kvartiraNotifications.js`);
  notifications.createNotificationForUser(
    app,
    userId,
    'system',
    'Вход в аккаунт',
    `Обнаружен вход с ${deviceLabel}.`,
    '/profile/settings/security',
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
  fingerprintToken,
  recordSecuritySession,
  markOnlyCurrentSession,
  trimSecuritySessions,
  assertSecuritySessionCreate,
  assertSecuritySessionUpdate,
  assertSecurityAlertUpdate,
};
