/// @ts-check
/**
 * ROADMAP 2.10 — notification + preferences hooks.
 * Create: self, admin, or teacher may target another user.
 * Update: only read flag may change on notifications; preferences user locked.
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
 * @param {core.RecordRequestEvent} e
 */
function assertNotificationCreate(e) {
  const auth = e.auth;
  if (!auth) {
    return;
  }

  const userId = relId(e.record.get('user'));
  if (userId === auth.id) return;

  const role = auth.getString('role');
  if (role === 'admin' || role === 'teacher') return;

  throw new ApiError(403, 'Нет доступа');
}

/**
 * @param {core.RecordRequestEvent} e
 */
function assertNotificationUpdate(e) {
  const auth = e.auth;
  if (!auth) {
    throw new ApiError(403, 'Нет доступа');
  }

  const original = typeof e.record.original === 'function' ? e.record.original() : e.record;
  e.record.set('user', original.get('user'));
  e.record.set('type', original.get('type'));
  e.record.set('title', original.get('title'));
  e.record.set('body', original.get('body'));
  e.record.set('link', original.get('link'));
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
 * @param {core.RecordRequestEvent} e
 */
function assertNotificationPreferencesCreate(e) {
  const auth = e.auth;
  if (!auth) {
    throw new ApiError(403, 'Нет доступа');
  }

  if (isUsersAuth(auth) && auth.getString('role') !== 'admin') {
    e.record.set('user', auth.id);
  }

  const userId = relId(e.record.get('user'));
  if (isUsersAuth(auth) && userId !== auth.id && auth.getString('role') !== 'admin') {
    throw new ApiError(403, 'Нет доступа');
  }
}

/**
 * @param {core.RecordRequestEvent} e
 */
function assertNotificationPreferencesUpdate(e) {
  const auth = e.auth;
  if (!auth) {
    throw new ApiError(403, 'Нет доступа');
  }

  const original = typeof e.record.original === 'function' ? e.record.original() : e.record;
  e.record.set('user', original.get('user'));

  const userId = relId(original.get('user'));
  if (userId !== auth.id && auth.getString('role') !== 'admin') {
    throw new ApiError(403, 'Нет доступа');
  }
}

module.exports = {
  relId,
  assertNotificationCreate,
  assertNotificationUpdate,
  assertNotificationPreferencesCreate,
  assertNotificationPreferencesUpdate,
  createNotificationForUser,
};

/**
 * @param {import('pocketbase').PocketBase} app
 * @param {string} userId
 * @param {string} type
 * @param {string} title
 * @param {string} body
 * @param {string} [link]
 */
function createNotificationForUser(app, userId, type, title, body, link) {
  try {
    const col = app.findCollectionByNameOrId('notifications');
    const record = new Record(col);
    record.set('user', userId);
    record.set('type', type);
    record.set('title', title);
    record.set('body', body);
    if (link) {
      record.set('link', link);
    }
    app.save(record);
  } catch (_) {
    /* never fail login / booking / etc. because of a notification write */
  }
}
