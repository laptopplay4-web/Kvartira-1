/// @ts-check
/**
 * ROADMAP 2.6 — progress write IDOR:
 * teacher may only write goals/skills/unlocks for students they teach.
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
 * @param {core.App} app
 * @param {string} teacherId
 * @param {string} studentId
 * @returns {boolean}
 */
function teacherHasStudent(app, teacherId, studentId) {
  if (!teacherId || !studentId) return false;
  const rows = app.findRecordsByFilter(
    'lessons',
    `teacher = "${teacherId}" && student = "${studentId}"`,
    '',
    1,
    0,
  );
  return rows.length > 0;
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
 * @param {core.App} app
 * @param {core.RecordRequestEvent} e
 */
function assertProgressCreate(app, e) {
  const auth = e.auth;
  if (!auth) {
    throw new ApiError(403, 'Нет доступа');
  }

  if (!isUsersAuth(auth)) return;

  const role = auth.getString('role');
  if (role === 'admin') return;

  if (role === 'student') {
    e.record.set('student', auth.id);
    return;
  }

  if (role === 'teacher') {
    const studentId = relId(e.record.get('student'));
    if (!teacherHasStudent(app, auth.id, studentId)) {
      throw new ApiError(403, 'Нет доступа к прогрессу ученика');
    }
    return;
  }

  throw new ApiError(403, 'Нет доступа');
}

/**
 * @param {core.App} app
 * @param {core.RecordRequestEvent} e
 */
function assertProgressUpdate(app, e) {
  const auth = e.auth;
  if (!auth) {
    throw new ApiError(403, 'Нет доступа');
  }
  if (!isUsersAuth(auth)) return;
  if (auth.getString('role') === 'admin') return;

  const original = typeof e.record.original === 'function' ? e.record.original() : e.record;
  e.record.set('student', original.get('student'));
  const studentId = relId(original.get('student'));
  const role = auth.getString('role');

  if (role === 'teacher') {
    if (!teacherHasStudent(app, auth.id, studentId)) {
      throw new ApiError(403, 'Нет доступа к прогрессу ученика');
    }
    return;
  }

  throw new ApiError(403, 'Нет доступа');
}

module.exports = {
  assertProgressCreate,
  assertProgressUpdate,
  teacherHasStudent,
  relId,
};
