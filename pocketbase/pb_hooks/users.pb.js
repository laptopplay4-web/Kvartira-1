/// @reference path="../pb_data/types.d.ts"
/**
 * Hide phone / email / original avatar from guests and non-owners.
 * Users list/view: auth OR public teacher profiles (landing).
 *
 * `email` MUST be hidden together with `phone`: accounts use synthetic
 * identities `{11 digits}@kvartira.local`, so a visible email is a readable
 * phone number.
 *
 * IMPORTANT: compare auth.id / record.id — system id is not a getString field.
 * IMPORTANT: PocketBase JSVM — call hide('a','b') as variadic args.
 * Using Function.prototype.apply on hide breaks goja and surfaces as
 * "Failed to enrich record", which empties the Admin users list.
 */

function hidePrivateUserFields(record) {
  // Variadic hide is the documented API; Function.prototype.apply breaks under goja.
  record.hide('phone', 'email', 'avatarOriginalUrl');
}

function isUsersAuth(auth) {
  if (!auth) return false;
  try {
    return auth.collection().name === 'users';
  } catch (_) {
    return false;
  }
}

onRecordEnrich((e) => {
  try {
    const auth = e.auth;

    // Guest / public: strip private fields.
    if (!auth) {
      hidePrivateUserFields(e.record);
      e.next();
      return;
    }

    // PocketBase Admin (_superusers) and any non-users auth must see full rows.
    if (!isUsersAuth(auth)) {
      e.next();
      return;
    }

    const authId = String(auth.id || '');
    const recordId = String(e.record.id || '');
    const isSelf = !!(authId && recordId && authId === recordId);

    let isAdmin = false;
    try {
      isAdmin = auth.getString('role') === 'admin';
    } catch (_) {
      isAdmin = false;
    }

    if (!isSelf && !isAdmin) {
      hidePrivateUserFields(e.record);
    }
  } catch (_) {
    // Enrich must never break list/view — better show fields than empty UI.
  }
  e.next();
}, 'users');

onRecordUpdateRequest((e) => {
  const users = require(`${__hooks}/lib/kvartiraUsers.js`);
  users.assertUserUpdate(e);
  e.next();
}, 'users');

onRecordAfterUpdateSuccess((e) => {
  try {
    // School admin|teacher → member of every group chat (idempotent; also heals legacy gaps).
    const role = e.record.getString('role');
    if (role === 'admin' || role === 'teacher') {
      const chat = require(`${__hooks}/lib/kvartiraChat.js`);
      chat.joinStaffUserToAllGroupChats($app, String(e.record.id));
    }
  } catch (_) {
    /* never block role change on chat join */
  }
  e.next();
}, 'users');

onRecordAfterCreateSuccess((e) => {
  try {
    const chat = require(`${__hooks}/lib/kvartiraChat.js`);
    chat.joinUserToSchoolWideChats($app, String(e.record.id));
    const role = e.record.getString('role');
    if (role === 'admin' || role === 'teacher') {
      chat.joinStaffUserToAllGroupChats($app, String(e.record.id));
    }
  } catch (_) {
    /* never block registration on chat join */
  }
  e.next();
}, 'users');

onRecordDeleteRequest((e) => {
  const users = require(`${__hooks}/lib/kvartiraUsers.js`);
  const audit = require(`${__hooks}/lib/kvartiraAudit.js`);

  // Logged before the purge: afterwards there is no record left to describe,
  // and the audit row must survive the account it refers to.
  const auth = e.auth;
  const initiator = auth && String(auth.id) === String(e.record.id) ? 'self' : 'admin';
  audit.logAccountDeletion($app, e, String(e.record.id), initiator);

  users.cleanupUserReferences($app, e.record.id);
  e.next();
}, 'users');

/**
 * Acknowledge a self-service data export so the audit journal records who
 * asked for a copy of their data (152-ФЗ, ст. 14). The payload itself is
 * assembled on the client from the normal APIs; this endpoint only logs.
 */
routerAdd('POST', '/api/kvartira/data-export/ack', (e) => {
  const audit = require(`${__hooks}/lib/kvartiraAudit.js`);
  const info = e.requestInfo();
  const auth = info && info.auth;
  if (!auth) {
    throw new ApiError(401, 'Нужна авторизация');
  }
  audit.logDataExport($app, e, String(auth.id));
  return e.json(200, { ok: true });
});
