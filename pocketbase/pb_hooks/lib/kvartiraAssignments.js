/// @ts-check
/**
 * Assignment + assignment_groups IDOR (groups + content blocks).
 */

/**
 * @param {core.Record} auth
 * @returns {boolean}
 */
function isUsersAuth(auth) {
  if (!auth) return false;
  try {
    return auth.collection().name === 'users';
  } catch (_) {
    return false;
  }
}

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
 * @param {core.App} app
 * @param {core.RecordRequestEvent} e
 */
function assertAssignmentCreate(app, e) {
  const auth = e.auth;
  if (!auth) {
    throw new ApiError(403, 'Нет доступа');
  }

  if (isUsersAuth(auth) && auth.getString('role') !== 'admin') {
    e.record.set('teacher', auth.id);
  }

  const groupId = relId(e.record.get('group'));
  if (!groupId) {
    throw new ApiError(400, 'Укажите группу получателей');
  }
  app.findRecordById('assignment_groups', groupId);

  const title = e.record.getString('title').trim();
  const description = e.record.getString('description').trim();
  if (!title || !description) {
    throw new ApiError(400, 'Заполните название и описание');
  }
  e.record.set('title', title);
  e.record.set('description', description);
}

/**
 * Assignments are immutable after create for app users (no submit/review).
 *
 * @param {core.App} _app
 * @param {core.RecordRequestEvent} e
 */
function assertAssignmentUpdate(_app, e) {
  const auth = e.auth;
  if (!auth) {
    throw new ApiError(403, 'Нет доступа');
  }
  if (!isUsersAuth(auth) || auth.getString('role') === 'admin') return;
  throw new ApiError(403, 'Нет доступа');
}

/**
 * @param {core.App} app
 * @param {core.RecordRequestEvent} e
 */
function assertAssignmentGroupCreate(app, e) {
  const auth = e.auth;
  if (!auth) {
    throw new ApiError(403, 'Нет доступа');
  }

  if (isUsersAuth(auth) && auth.getString('role') !== 'admin') {
    e.record.set('teacher', auth.id);
    e.record.set('kind', 'custom');
  }

  const name = e.record.getString('name').trim();
  if (!name || name.length < 2) {
    throw new ApiError(400, 'Введите название группы');
  }
  e.record.set('name', name);

  const memberIds = e.record.get('members') || [];
  assertMembersAreStudents(app, memberIds);
}

/**
 * @param {core.App} app
 * @param {core.RecordRequestEvent} e
 */
function assertAssignmentGroupUpdate(app, e) {
  const auth = e.auth;
  if (!auth) {
    throw new ApiError(403, 'Нет доступа');
  }
  if (!isUsersAuth(auth) || auth.getString('role') === 'admin') {
    assertMembersAreStudents(app, e.record.get('members') || []);
    return;
  }

  const record = e.record;
  const original = typeof record.original === 'function' ? record.original() : record;
  const kind = original.getString('kind');
  if (kind === 'general') {
    throw new ApiError(403, 'Общую группу нельзя изменить');
  }
  if (relId(original.get('teacher')) !== auth.id) {
    throw new ApiError(403, 'Нет доступа');
  }

  record.set('teacher', original.get('teacher'));
  record.set('kind', kind);

  const name = record.getString('name').trim();
  if (!name || name.length < 2) {
    throw new ApiError(400, 'Введите название группы');
  }
  record.set('name', name);
  assertMembersAreStudents(app, record.get('members') || []);
}

/**
 * @param {core.App} _app
 * @param {core.RecordRequestEvent} e
 */
function assertAssignmentGroupDelete(_app, e) {
  const users = require(`${__hooks}/lib/kvartiraUsers.js`);
  if (users.isUserPurgeInProgress()) return;

  const auth = e.auth;
  if (!auth) return;
  if (!isUsersAuth(auth) || auth.getString('role') === 'admin') return;

  const kind = e.record.getString('kind');
  if (kind === 'general') {
    throw new ApiError(403, 'Общую группу нельзя удалить');
  }
  if (relId(e.record.get('teacher')) !== auth.id) {
    throw new ApiError(403, 'Нет доступа');
  }
}

/**
 * @param {core.App} app
 * @param {unknown} members
 */
function assertMembersAreStudents(app, members) {
  const ids = Array.isArray(members) ? members.map(relId).filter(Boolean) : [];
  for (const id of ids) {
    const user = app.findRecordById('users', id);
    if (user.getString('role') !== 'student') {
      throw new ApiError(400, 'В группу можно добавить только ученика');
    }
  }
}

module.exports = {
  assertAssignmentCreate,
  assertAssignmentUpdate,
  assertAssignmentGroupCreate,
  assertAssignmentGroupUpdate,
  assertAssignmentGroupDelete,
  relId,
};
