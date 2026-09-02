/// @reference path="../pb_data/types.d.ts"
/**
 * Hide phone / original avatar from guests and non-owners.
 * Users list/view: auth OR public teacher profiles (landing).
 *
 * IMPORTANT: compare auth.id / record.id — system id is not a getString field.
 */

onRecordEnrich((e) => {
  const auth = e.auth;
  if (!auth) {
    e.record.hide('phone', 'avatarOriginalUrl');
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
    e.record.hide('phone', 'avatarOriginalUrl');
  }
  e.next();
}, 'users');

onRecordUpdateRequest((e) => {
  const users = require(`${__hooks}/lib/kvartiraUsers.js`);
  users.assertUserUpdate(e);
  e.next();
}, 'users');

onRecordDeleteRequest((e) => {
  const users = require(`${__hooks}/lib/kvartiraUsers.js`);
  users.cleanupUserReferences($app, e.record.id);
  e.next();
}, 'users');
