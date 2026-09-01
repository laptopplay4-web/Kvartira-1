/// @ts-check
/**
 * ROADMAP 1.3 — shared auth helpers (phone login, login history).
 * Mirrors mock recordAuthLogin behavior in src/services/api/mock/security.ts.
 */

/** @typedef {{ request?: { header?: { get: (name: string) => string } } }} AuthEvent */

const PHONE_REGEX = /^\+79\d{9}$/;
const MAX_LOGIN_HISTORY = 100;
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
 * @returns {string}
 */
function getClientIp(e) {
  if (typeof e.realIP === 'function') {
    const ip = e.realIP();
    if (ip) return ip;
  }
  return '0.0.0.0';
}

/**
 * @param {AuthEvent} e
 * @returns {string}
 */
function getDeviceLabel(e) {
  const ua = e.request?.header?.get('User-Agent') || '';
  if (!ua) return 'Unknown device';
  if (/Windows/i.test(ua)) return 'Browser · Windows';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'Browser · macOS';
  if (/Android/i.test(ua)) return 'Browser · Android';
  if (/iPhone|iPad/i.test(ua)) return 'Browser · iOS';
  if (/Linux/i.test(ua)) return 'Browser · Linux';
  return 'Browser';
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
  entry.set('success', success);
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
  const rows = [];
  app.findRecordsByFilter(
    'login_history',
    'user = {:userId}',
    '-id',
    MAX_LOGIN_HISTORY + 1,
    0,
    { userId },
    rows,
  );
  for (let i = MAX_LOGIN_HISTORY; i < rows.length; i++) {
    app.delete(rows[i]);
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

module.exports = {
  normalizePhone,
  phoneToEmail,
  getClientIp,
  getDeviceLabel,
  recordLoginAttempt,
  pushSecurityAlert,
  isValidPhone,
  PHONE_REGEX,
};
