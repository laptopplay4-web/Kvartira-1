/// @ts-check
/**
 * ROADMAP 1.3 — shared auth helpers (phone login, login history).
 * Mirrors mock recordAuthLogin behavior in src/services/api/mock/security.ts.
 */

/** @typedef {{ request?: { header?: { get: (name: string) => string } } }} AuthEvent */

const PHONE_REGEX = /^\+79\d{9}$/;
const MAX_LOGIN_HISTORY = 100;
/** Failed attempts per user+IP allowed inside the window before a 429. */
const MAX_FAILED_LOGINS = 10;
const LOGIN_THROTTLE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_THROTTLE_LOOKBACK = 50;
const FAILED_LOGIN_TITLE = 'Неудачная попытка входа';
const FAILED_LOGIN_MESSAGE =
  'Кто-то пытался войти в аккаунт с неверным паролем.';
const SECURITY_SETTINGS_LINK = '/profile/settings/security';

/**
 * @param {string} phone
 * @returns {string}
 */
function normalizePhone(phone) {
  const trimmed = String(phone || '').trim();
  if (PHONE_REGEX.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('79')) return `+${digits}`;
  if (digits.length === 10 && digits.startsWith('9')) return `+7${digits}`;
  return trimmed;
}

/**
 * @param {string} phone
 * @returns {string}
 */
function phoneToEmail(phone) {
  const digits = normalizePhone(phone).replace(/\D/g, '');
  return `${digits || 'unknown'}@kvartira.local`;
}

/**
 * @param {AuthEvent} e
 * @returns {{ headers?: Record<string, string>, remoteIP?: string } | null}
 */
function getRequestInfoSafe(e) {
  try {
    if (typeof e.requestInfo === 'function') {
      return e.requestInfo() || null;
    }
  } catch (_) {
    /* older event shape */
  }
  return null;
}

/**
 * @param {AuthEvent} e
 * @returns {string}
 */
function getClientIp(e) {
  const info = getRequestInfoSafe(e);
  if (info && info.remoteIP) return info.remoteIP;
  try {
    if (typeof e.realIP === 'function') {
      const ip = e.realIP();
      if (ip) return ip;
    }
  } catch (_) {
    /* ignore */
  }
  return '0.0.0.0';
}

/**
 * @param {string} ua
 * @returns {string}
 */
function detectBrowserName(ua) {
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/OPR\/|Opera/i.test(ua)) return 'Opera';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/Chrome\//i.test(ua) || /CriOS\//i.test(ua)) return 'Chrome';
  if (/Safari\//i.test(ua)) return 'Safari';
  return 'Browser';
}

/**
 * @param {string} ua
 * @returns {string}
 */
function detectOsName(ua) {
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return '';
}

/**
 * @param {AuthEvent} e
 * @returns {string}
 */
function getDeviceLabel(e) {
  const info = getRequestInfoSafe(e);
  const headers = (info && info.headers) || {};
  const ua = headers['user-agent'] || headers['User-Agent'] || '';
  if (!ua) return 'Неизвестное устройство';
  const browser = detectBrowserName(ua);
  const os = detectOsName(ua);
  return os ? `${browser} · ${os}` : browser;
}

/**
 * @param {import('pocketbase').PocketBase} app
 * @param {string} userId
 * @param {boolean} success
 * @param {AuthEvent} e
 */
function recordLoginAttempt(app, userId, success, e) {
  const deviceLabel = getDeviceLabel(e);
  const ipAddress = getClientIp(e);

  const historyCol = app.findCollectionByNameOrId('login_history');
  const entry = new Record(historyCol);
  entry.set('user', userId);
  entry.set('deviceLabel', deviceLabel);
  entry.set('ipAddress', ipAddress);
  if (success) {
    entry.set('success', true);
  }
  // Omit `success: false` — PB JSVM treats false as blank on required bool fields.
  app.save(entry);

  trimLoginHistory(app, userId);

  if (!success) {
    const notifications = require(`${__hooks}/lib/kvartiraNotifications.js`);
    notifications.createNotificationForUser(
      app,
      userId,
      'system',
      FAILED_LOGIN_TITLE,
      FAILED_LOGIN_MESSAGE,
      SECURITY_SETTINGS_LINK,
    );
  }
}

/**
 * @param {import('pocketbase').PocketBase} app
 * @param {string} userId
 */
function trimLoginHistory(app, userId) {
  /** @type {Record[]} */
  let rows = [];
  try {
    rows =
      app.findRecordsByFilter(
        'login_history',
        'user = {:userId}',
        '-id',
        MAX_LOGIN_HISTORY + 1,
        0,
        { userId },
      ) || [];
  } catch (_) {
    return;
  }
  for (let i = MAX_LOGIN_HISTORY; i < rows.length; i++) {
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
 * @param {'new_device' | 'password_changed' | 'failed_login' | 'session_revoked'} type
 * @param {string} title
 * @param {string} message
 * @deprecated Use createNotificationForUser in kvartiraNotifications.js
 */
function pushSecurityAlert(app, userId, type, title, message) {
  const alertsCol = app.findCollectionByNameOrId('security_alerts');
  const alert = new Record(alertsCol);
  alert.set('user', userId);
  alert.set('type', type);
  alert.set('title', title);
  alert.set('message', message);
  // Omit `read: false` — PB JSVM treats false as blank on required bool fields (see migration 1788931200).
  app.save(alert);
}

/**
 * @param {string} phone
 * @returns {boolean}
 */
function isValidPhone(phone) {
  return PHONE_REGEX.test(normalizePhone(phone));
}

/**
 * Throttle password guessing.
 *
 * `login_history` already records every failed attempt with the user and the
 * client IP, so it doubles as the counter — no extra collection, and the limit
 * survives a PocketBase restart. Successful logins reset the window because the
 * lookup only counts rows newer than the last success.
 *
 * @param {import('pocketbase').PocketBase} app
 * @param {string} userId
 * @param {AuthEvent} e
 * @throws {ApiError} 429 once the limit is reached
 */
function assertLoginNotThrottled(app, userId, e) {
  if (!userId) return;

  const since = new Date(Date.now() - LOGIN_THROTTLE_WINDOW_MS)
    .toISOString()
    .replace('T', ' ')
    .replace(/\..+$/, 'Z');

  /** @type {Record[]} */
  let recent = [];
  try {
    recent =
      app.findRecordsByFilter(
        'login_history',
        'user = {:userId} && created >= {:since}',
        '-created',
        LOGIN_THROTTLE_LOOKBACK,
        0,
        { userId, since },
      ) || [];
  } catch (_) {
    // Never lock people out because the counter itself failed.
    return;
  }

  const ip = getClientIp(e);
  let failures = 0;

  for (const row of recent) {
    // A success inside the window clears the streak.
    if (row.getBool('success')) break;
    if (row.getString('ipAddress') === ip) failures += 1;
  }

  if (failures >= MAX_FAILED_LOGINS) {
    throw new ApiError(429, 'Слишком много попыток входа. Повторите через 15 минут.');
  }
}

module.exports = {
  normalizePhone,
  phoneToEmail,
  getClientIp,
  getDeviceLabel,
  recordLoginAttempt,
  assertLoginNotThrottled,
  pushSecurityAlert,
  isValidPhone,
  PHONE_REGEX,
  MAX_FAILED_LOGINS,
  LOGIN_THROTTLE_WINDOW_MS,
};
