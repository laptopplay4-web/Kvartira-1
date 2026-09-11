/// @ts-check
/**
 * User delete — remove dependent records and optional references
 * before PocketBase removes the auth record.
 */

const { relId } = require(`${__hooks}/lib/kvartiraEvents.js`);

/** @type {boolean} */
let userPurgeInProgress = false;

function isUserPurgeInProgress() {
  return userPurgeInProgress;
}

/**
 * @param {core.App} app
 * @param {string} collection
 * @param {string} filter
 * @param {Record<string, unknown>} [params]
 */
function deleteAllByFilter(app, collection, filter, params = {}) {
  const batchSize = 200;
  for (let i = 0; i < 50; i += 1) {
    /** @type {Record[]} */
    let rows = [];
    try {
      rows = app.findRecordsByFilter(collection, filter, '-id', batchSize, 0, params) || [];
    } catch (_) {
      return;
    }
    if (!rows.length) return;
    for (const row of rows) {
      try {
        app.delete(row);
      } catch (_) {
        /* best-effort; next pass or cascade may still succeed */
      }
    }
    if (rows.length < batchSize) return;
  }
}

/**
 * @param {core.App} app
 * @param {string} collection
 * @param {string} fieldName
 * @param {string} userId
 */
function clearOptionalRelation(app, collection, fieldName, userId) {
  /** @type {Record[]} */
  let rows = [];
  try {
    rows =
      app.findRecordsByFilter(collection, `${fieldName} = {:userId}`, '', 500, 0, { userId }) ||
      [];
  } catch (_) {
    return;
  }

  for (const row of rows) {
    row.set(fieldName, '');
    app.save(row);
  }
}

/**
 * @param {core.App} app
 * @param {string} userId
 */
function removeFromAssignmentGroupMembers(app, userId) {
  /** @type {Record[]} */
  let rows = [];
  try {
    rows =
      app.findRecordsByFilter(
        'assignment_groups',
        'members.id ?= {:userId}',
        '',
        500,
        0,
        { userId },
      ) || [];
  } catch (_) {
    return;
  }

  for (const row of rows) {
    const raw = row.get('members');
    /** @type {string[]} */
    let ids = [];
    if (Array.isArray(raw)) {
      ids = raw.map(relId).filter(Boolean);
    } else if (raw) {
      ids = [relId(raw)];
    }
    if (!ids.includes(userId)) continue;
    row.set(
      'members',
      ids.filter((id) => id !== userId),
    );
    app.save(row);
  }
}

/**
 * @param {core.App} app
 * @param {string} collection
 * @param {string} fieldName
 * @param {string} userId
 */
function removeUserFromJsonArrayField(app, collection, fieldName, userId) {
  /** @type {Record[]} */
  let rows = [];
  try {
    rows = app.findRecordsByFilter(collection, '', '', 500, 0) || [];
  } catch (_) {
    return;
  }

  for (const row of rows) {
    const raw = row.get(fieldName);
    if (!Array.isArray(raw) || !raw.includes(userId)) continue;
    row.set(
      fieldName,
      raw.filter((id) => id !== userId),
    );
    app.save(row);
  }
}

/**
 * @param {core.App} app
 * @param {string} userId
 */
function purgeUserDependents(app, userId) {
  const params = { userId };

  // Keep chat history for remaining participants (personal chats stay visible).
  // messages.sender must be optional + non-cascade (see migration 1790572800).
  clearOptionalRelation(app, 'messages', 'sender', userId);

  deleteAllByFilter(app, 'lesson_history', 'user = {:userId}', params);
  deleteAllByFilter(app, 'lessons', 'student = {:userId} || teacher = {:userId}', params);
  deleteAllByFilter(app, 'assignments', 'teacher = {:userId}', params);
  deleteAllByFilter(app, 'assignment_groups', 'teacher = {:userId}', params);
  deleteAllByFilter(app, 'teacher_availability', 'teacher = {:userId}', params);

  clearOptionalRelation(app, 'audit_logs', 'actor', userId);
  removeFromAssignmentGroupMembers(app, userId);
  removeUserFromJsonArrayField(app, 'events', 'registeredUserIds', userId);
  removeUserFromJsonArrayField(app, 'events', 'invitedUserIds', userId);
  // Drop from all chats' participantIds (school-wide + groups + personal).
  // conversation_members rows cascade-delete with the user record.
  // Personal conversations remain for the other participant with message history.
  removeUserFromJsonArrayField(app, 'conversations', 'participantIds', userId);
}

/**
 * @param {core.App} app
 * @param {string} userId
 */
function cleanupUserReferences(app, userId) {
  userPurgeInProgress = true;
  try {
    purgeUserDependents(app, userId);
  } finally {
    userPurgeInProgress = false;
  }
}

function isUsersAuth(auth) {
  if (!auth) return false;
  try {
    return auth.collection().name === 'users';
  } catch (_) {
    return false;
  }
}

function isStaffRole(role) {
  return role === 'student' || role === 'teacher';
}

/**
 * Lock role: only admin may switch student ↔ teacher.
 * Superuser (non-users auth) is unrestricted.
 *
 * Partial PATCH must not treat omitted fields as blank — otherwise phone/email
 * look "changed" and the update is rejected (client then sees a failed save and
 * the teacher-directions modal never closes).
 *
 * @param {core.RecordRequestEvent} e
 */
function assertUserUpdate(e) {
  const auth = e.auth;
  if (!isUsersAuth(auth)) return;

  const info = typeof e.requestInfo === 'function' ? e.requestInfo() : null;
  const body = (info && info.body) || {};
  const original = typeof e.record.original === 'function' ? e.record.original() : null;

  if (original) {
    if (!Object.prototype.hasOwnProperty.call(body, 'phone')) {
      e.record.set('phone', original.getString('phone'));
    }
    if (!Object.prototype.hasOwnProperty.call(body, 'email')) {
      e.record.set('email', original.getString('email'));
    }
    if (!Object.prototype.hasOwnProperty.call(body, 'role')) {
      e.record.set('role', original.getString('role'));
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'phone')) {
    const oldPhone = original ? original.getString('phone') : '';
    const newPhone = e.record.getString('phone');
    if (oldPhone !== newPhone) {
      throw new ApiError(400, 'Нельзя изменить номер телефона');
    }
  }

  if (!Object.prototype.hasOwnProperty.call(body, 'role')) return;

  const oldRole = original ? original.getString('role') : e.record.getString('role');
  const newRole = e.record.getString('role');
  if (oldRole === newRole) return;

  if (auth.getString('role') !== 'admin') {
    throw new ApiError(403, 'Нельзя изменить роль');
  }

  if (String(auth.id) === String(e.record.id)) {
    throw new ApiError(400, 'Нельзя изменить собственную роль');
  }

  if (oldRole === 'admin' || !isStaffRole(newRole) || !isStaffRole(oldRole)) {
    throw new ApiError(400, 'Можно менять только роли ученика и преподавателя');
  }
}

module.exports = {
  cleanupUserReferences,
  isUserPurgeInProgress,
  assertUserUpdate,
};
