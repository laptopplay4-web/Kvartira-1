/// @ts-check
/**
 * Registration invite (QR wall code) — stored in school_settings.contacts.registrationInvite.
 */

const INVITE_HEADER = 'X-Registration-Invite';
const INVALID_MSG =
  'Регистрация доступна только по QR-коду в школе. Отсканируйте код на стенде.';

/**
 * The token shipped by `npm run pb:seed` is committed to the repository, so it
 * is public knowledge. It is fine for local development, but on a real install
 * it must be rotated via /admin/registration-qr before anyone can register.
 */
const SEED_INVITE_TOKEN = 'kvartira-school-invite-7f3a9c2e1b8d4e6f0a5c9d2e8b1f4a7c';
const SEED_INVITE_MSG =
  'Регистрация закрыта: администратор ещё не сменил код приглашения. ' +
  'Откройте /admin/registration-qr и нажмите «Сменить».';

/**
 * @param {unknown} value
 * @returns {Record<string, unknown> | null}
 */
function asObject(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return /** @type {Record<string, unknown>} */ (parsed);
      }
    } catch (_) {
      return null;
    }
    return null;
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return /** @type {Record<string, unknown>} */ (value);
  }
  return null;
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function tokensEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * @param {import('pocketbase').PocketBase} app
 * @returns {{ token: string, rotatedAt: string } | null}
 */
function readStoredInvite(app) {
  try {
    const records = app.findRecordsByFilter('school_settings', '', '-id', 1, 0);
    const list = Array.isArray(records) ? records : [];
    const record = list[0];
    if (!record) return null;
    const contacts = asObject(record.get('contacts'));
    if (!contacts) return null;
    const invite = asObject(contacts.registrationInvite);
    if (!invite || typeof invite.token !== 'string' || !invite.token.trim()) return null;
    return {
      token: String(invite.token).trim(),
      rotatedAt:
        typeof invite.rotatedAt === 'string' && invite.rotatedAt
          ? String(invite.rotatedAt)
          : '',
    };
  } catch (_) {
    return null;
  }
}

/**
 * @param {import('pocketbase').PocketBase} app
 * @param {string} token
 * @returns {boolean}
 */
function isValidInviteToken(app, token) {
  const normalized = String(token || '').trim();
  if (!normalized || normalized.length < 32) return false;
  const stored = readStoredInvite(app);
  if (!stored || !stored.token) return false;
  return tokensEqual(normalized, stored.token);
}

/**
 * @param {any} e
 * @returns {string}
 */
function readInviteFromRequest(e) {
  try {
    const info = typeof e.requestInfo === 'function' ? e.requestInfo() : null;
    const headers = (info && info.headers) || {};
    const fromHeader =
      headers[INVITE_HEADER] ||
      headers[INVITE_HEADER.toLowerCase()] ||
      headers['x-registration-invite'] ||
      '';
    if (fromHeader) return String(fromHeader).trim();

    const body = (info && info.body) || {};
    if (body.inviteToken) return String(body.inviteToken).trim();
    if (body.registrationInviteToken) return String(body.registrationInviteToken).trim();
  } catch (_) {
    /* ignore */
  }
  return '';
}

/**
 * Strip invite secret from public/non-admin school_settings responses.
 * @param {any} e
 */
function stripInviteFromSchoolSettingsRecord(e) {
  try {
    const info = typeof e.requestInfo === 'function' ? e.requestInfo() : null;
    const auth = info && info.auth;
    let isAdmin = false;
    if (auth) {
      try {
        isAdmin =
          auth.collection().name === 'users' && String(auth.getString('role')) === 'admin';
      } catch (_) {
        isAdmin = false;
      }
    }
    if (isAdmin) return;

    const contacts = asObject(e.record.get('contacts'));
    if (!contacts || !contacts.registrationInvite) return;
    const next = { ...contacts };
    delete next.registrationInvite;
    e.record.set('contacts', next);
  } catch (_) {
    /* never fail enrich */
  }
}

/**
 * Public self-registration must present a valid wall QR invite.
 * Superuser (seed) and authenticated admin create skip the check.
 * @param {any} e
 */
function assertRegistrationInviteOnUserCreate(e) {
  const rbac = require(`${__hooks}/lib/kvartiraRbac.js`);
  const info = typeof e.requestInfo === 'function' ? e.requestInfo() : null;
  const auth = info && info.auth;

  // Superuser / non-users auth (seed, Admin UI) — allow without invite.
  if (auth && !rbac.isUsersAuth(auth)) return;

  // Authenticated admin creating a user record — allow.
  if (auth && rbac.isUsersAuth(auth) && auth.getString('role') === 'admin') return;

  const token = readInviteFromRequest(e);
  if (!token || !isValidInviteToken($app, token)) {
    throw new BadRequestError(INVALID_MSG);
  }

  // Fail closed: a valid-but-default token means the install was never secured.
  if (!isDevEnvironment() && tokensEqual(String(token).trim(), SEED_INVITE_TOKEN)) {
    throw new BadRequestError(SEED_INVITE_MSG);
  }
}

/**
 * `KVARTIRA_DEV=1` keeps the seeded token usable on a developer machine.
 * @returns {boolean}
 */
function isDevEnvironment() {
  try {
    return String($os.getenv('KVARTIRA_DEV') || '') === '1';
  } catch (_) {
    return false;
  }
}

module.exports = {
  INVITE_HEADER,
  INVALID_MSG,
  SEED_INVITE_TOKEN,
  SEED_INVITE_MSG,
  isDevEnvironment,
  isValidInviteToken,
  readStoredInvite,
  readInviteFromRequest,
  stripInviteFromSchoolSettingsRecord,
  assertRegistrationInviteOnUserCreate,
};
