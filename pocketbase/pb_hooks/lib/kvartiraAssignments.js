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
 * Teacher or admin may update title/description/group/contentBlocks.
 * Author (`teacher`) is locked; students cannot write.
 *
 * @param {core.App} app
 * @param {core.RecordRequestEvent} e
 */
function assertAssignmentUpdate(app, e) {
  const auth = e.auth;
  if (!auth) {
    throw new ApiError(403, 'Нет доступа');
  }

  const role = isUsersAuth(auth) ? auth.getString('role') : '';
  const isStaff = role === 'admin' || role === 'teacher';
  if (isUsersAuth(auth) && !isStaff) {
    throw new ApiError(403, 'Нет доступа');
  }

  const record = e.record;
  const original = typeof record.original === 'function' ? record.original() : record;
  record.set('teacher', original.get('teacher'));

  const groupId = relId(record.get('group'));
  if (!groupId) {
    throw new ApiError(400, 'Укажите группу получателей');
  }
  app.findRecordById('assignment_groups', groupId);

  const title = record.getString('title').trim();
  const description = record.getString('description').trim();
  if (!title || !description) {
    throw new ApiError(400, 'Заполните название и описание');
  }
  record.set('title', title);
  record.set('description', description);
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
  }

  const requestedKind = e.record.getString('kind') || 'custom';
  if (requestedKind === 'general') {
    /** @type {Record[]} */
    let existing = [];
    try {
      existing =
        app.findRecordsByFilter('assignment_groups', 'kind = "general"', '-id', 1, 0) || [];
    } catch (_) {
      existing = [];
    }
    if (existing.length > 0) {
      throw new ApiError(400, 'Общая группа уже существует');
    }
    e.record.set('kind', 'general');
  } else {
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

  const record = e.record;
  const original = typeof record.original === 'function' ? record.original() : record;
  const originalKind = original.getString('kind');
  const requestedKind = record.getString('kind') || originalKind;

  if (!isUsersAuth(auth) || auth.getString('role') === 'admin') {
    if (requestedKind === 'general' && originalKind !== 'general') {
      /** @type {Record[]} */
      let existing = [];
      try {
        existing =
          app.findRecordsByFilter('assignment_groups', 'kind = "general"', '-id', 1, 0) || [];
      } catch (_) {
        existing = [];
      }
      if (existing.length > 0 && existing[0].id !== record.id) {
        throw new ApiError(400, 'Общая группа уже существует');
      }
    }
    assertMembersAreStudents(app, e.record.get('members') || []);
    return;
  }

  if (originalKind === 'general') {
    throw new ApiError(403, 'Общую группу нельзя изменить');
  }
  if (relId(original.get('teacher')) !== auth.id) {
    throw new ApiError(403, 'Нет доступа');
  }

  record.set('teacher', original.get('teacher'));

  if (requestedKind === 'general') {
    /** @type {Record[]} */
    let existing = [];
    try {
      existing =
        app.findRecordsByFilter('assignment_groups', 'kind = "general"', '-id', 1, 0) || [];
    } catch (_) {
      existing = [];
    }
    if (existing.length > 0 && existing[0].id !== record.id) {
      throw new ApiError(400, 'Общая группа уже существует');
    }
    record.set('kind', 'general');
  } else {
    record.set('kind', originalKind || 'custom');
  }

  const name = record.getString('name').trim();
  if (!name || name.length < 2) {
    throw new ApiError(400, 'Введите название группы');
  }
  record.set('name', name);
  assertMembersAreStudents(app, record.get('members') || []);
}

/**
 * @param {core.App} app
 * @param {core.RecordRequestEvent} e
 */
function assertAssignmentGroupDelete(app, e) {
  const users = require(`${__hooks}/lib/kvartiraUsers.js`);
  if (users.isUserPurgeInProgress()) return;

  const auth = e.auth;
  if (!auth) return;

  const kind = e.record.getString('kind');
  if (kind === 'general') {
    throw new ApiError(403, 'Общую группу нельзя удалить');
  }

  if (!isUsersAuth(auth) || auth.getString('role') === 'admin') {
    purgeAssignmentsForGroup(app, e.record.id);
    return;
  }

  if (relId(e.record.get('teacher')) !== auth.id) {
    throw new ApiError(403, 'Нет доступа');
  }
  purgeAssignmentsForGroup(app, e.record.id);
}

/**
 * assignments.group is required without cascadeDelete — remove linked rows first.
 * @param {core.App} app
 * @param {string} groupId
 */
function purgeAssignmentsForGroup(app, groupId) {
  if (!groupId) return;
  const batchSize = 200;
  for (let i = 0; i < 50; i += 1) {
    /** @type {Record[]} */
    let rows = [];
    try {
      rows =
        app.findRecordsByFilter(
          'assignments',
          'group = {:groupId}',
          '-id',
          batchSize,
          0,
          { groupId },
        ) || [];
    } catch (_) {
      return;
    }
    if (!rows.length) return;
    for (const row of rows) {
      try {
        app.delete(row);
      } catch (_) {
        /* best-effort */
      }
    }
    if (rows.length < batchSize) return;
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

/**
 * @param {core.App} app
 * @param {core.Record} group
 * @returns {string[]}
 */
function resolveAssignmentRecipientIds(app, group) {
  const kind = group.getString('kind');
  const name = group.getString('name');
  const isSchoolWide = kind === 'general' || name === 'Все ученики';

  if (isSchoolWide) {
    try {
      const students =
        app.findRecordsByFilter('users', 'role = "student"', '-id', 500, 0) || [];
      return students.map((s) => s.id).filter(Boolean);
    } catch (_) {
      return [];
    }
  }

  const raw = group.get('members') || [];
  return Array.isArray(raw) ? raw.map(relId).filter(Boolean) : [];
}

/**
 * After create: in-app assignment notification (book badge) + push via notifications hook.
 * Not shown in notifications inbox on the client.
 *
 * @param {core.App} app
 * @param {core.Record} record
 */
function notifyAssignmentCreated(app, record) {
  try {
    const groupId = relId(record.get('group'));
    if (!groupId) return;

    const group = app.findRecordById('assignment_groups', groupId);
    const memberIds = resolveAssignmentRecipientIds(app, group);
    if (!memberIds.length) return;

    const notifications = require(`${__hooks}/lib/kvartiraNotifications.js`);
    const title = 'Новое домашнее задание';
    const body = record.getString('title') || 'Новые материалы';
    const link = `/assignments/${record.id}`;

    for (const userId of memberIds) {
      notifications.createNotificationForUser(app, userId, 'assignment', title, body, link);
    }
  } catch (_) {
    /* never fail assignment create because of notify */
  }
}

module.exports = {
  assertAssignmentCreate,
  assertAssignmentUpdate,
  assertAssignmentGroupCreate,
  assertAssignmentGroupUpdate,
  assertAssignmentGroupDelete,
  purgeAssignmentsForGroup,
  notifyAssignmentCreated,
  relId,
};
