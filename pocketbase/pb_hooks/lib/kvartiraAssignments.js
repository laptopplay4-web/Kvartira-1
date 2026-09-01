/// @ts-check
/**
 * ROADMAP 2.5 — assignment create/update IDOR.
 * Mirrors mock AssignmentsApi: teacher creates, student submits, teacher reviews.
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
 * Teacher (non-admin) is always the creator; student must be a student role.
 *
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
    e.record.set('status', 'assigned');
    e.record.set('submission', null);
    e.record.set('feedback', null);
  }

  const studentId = relId(e.record.get('student'));
  if (!studentId) {
    throw new ApiError(400, 'Укажите ученика');
  }

  const student = app.findRecordById('users', studentId);
  if (student.getString('role') !== 'student') {
    throw new ApiError(400, 'Задание можно назначить только ученику');
  }

  const title = e.record.getString('title').trim();
  const description = e.record.getString('description').trim();
  if (!title || !description) {
    throw new ApiError(400, 'Заполните название и описание');
  }
  e.record.set('title', title);
  e.record.set('description', description);
}

/**
 * Student may only set submission + status=submitted (from assigned).
 * Teacher may only set feedback + status=reviewed (from submitted).
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

  const record = e.record;
  const original = typeof record.original === 'function' ? record.original() : record;
  const authId = auth.id;
  const role = auth.getString('role');
  const teacherId = relId(original.get('teacher'));
  const studentId = relId(original.get('student'));
  const oldStatus = original.getString('status');

  const newSubmission = record.get('submission');
  const newFeedback = record.get('feedback');

  const locked = [
    'teacher',
    'student',
    'title',
    'description',
    'lesson',
    'dueDate',
    'responseType',
    'materials',
    'submission',
    'feedback',
    'status',
  ];
  for (const field of locked) {
    record.set(field, original.get(field));
  }

  if (role === 'student' && authId === studentId) {
    if (oldStatus !== 'assigned') {
      throw new ApiError(403, 'Нельзя отправить ответ на это задание');
    }
    record.set('submission', newSubmission);
    record.set('status', 'submitted');
    return;
  }

  if (role === 'teacher' && authId === teacherId) {
    if (oldStatus !== 'submitted') {
      throw new ApiError(403, 'Нельзя проверить это задание');
    }
    record.set('feedback', newFeedback);
    record.set('status', 'reviewed');
    return;
  }

  throw new ApiError(403, 'Нет доступа');
}

module.exports = {
  assertAssignmentCreate,
  assertAssignmentUpdate,
  relId,
};
