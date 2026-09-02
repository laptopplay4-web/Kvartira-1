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

  deleteAllByFilter(app, 'messages', 'sender = {:userId}', params);
  deleteAllByFilter(app, 'lesson_history', 'user = {:userId}', params);
  deleteAllByFilter(app, 'lessons', 'student = {:userId} || teacher = {:userId}', params);
  deleteAllByFilter(app, 'assignments', 'teacher = {:userId}', params);
  deleteAllByFilter(app, 'assignment_groups', 'teacher = {:userId}', params);
  deleteAllByFilter(app, 'teacher_availability', 'teacher = {:userId}', params);

  clearOptionalRelation(app, 'progress_goals', 'teacher', userId);
  clearOptionalRelation(app, 'audit_logs', 'actor', userId);
  removeFromAssignmentGroupMembers(app, userId);
  removeUserFromJsonArrayField(app, 'events', 'registeredUserIds', userId);
  removeUserFromJsonArrayField(app, 'events', 'invitedUserIds', userId);
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
 * @param {core.RecordRequestEvent} e
 */
function assertUserUpdate(e) {
  const auth = e.auth;
  if (!isUsersAuth(auth)) return;

  const original = typeof e.record.original === 'function' ? e.record.original() : e.record;
  const oldPhone = original.getString('phone');
  const newPhone = e.record.getString('phone');
  if (oldPhone !== newPhone) {
    throw new ApiError(400, 'Нельзя изменить номер телефона');
  }

  const oldRole = original.getString('role');
  const newRole = e.record.getString('role');
  if (oldRole === newRole) return;

  if (auth.getString('role') !== 'admin') {
    throw new ApiError(403, 'Нельзя изменить роль');
  }

  if (auth.id === e.record.id) {
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
