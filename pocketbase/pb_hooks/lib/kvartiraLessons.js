/// @ts-check
/**
 * Lesson IDOR + field locks.
 *
 * PB `lessons` rules only check participation, so without these hooks any
 * participant could PATCH arbitrary fields (swap teacher, rewrite
 * `teacherNotes`, move the slot). Mirrors the client guards in
 * `src/services/lessons/access.ts`.
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

/** Fields a student may never touch. */
const STUDENT_LOCKED_FIELDS = [
  'student',
  'teacher',
  'direction',
  'durationMinutes',
  'location',
  'materials',
  'teacherNotes',
];

/** Fields a teacher may never touch (participants and slot length are fixed). */
const TEACHER_LOCKED_FIELDS = ['student', 'teacher', 'direction', 'durationMinutes'];

/** Statuses a student is allowed to set. */
const STUDENT_ALLOWED_STATUSES = ['cancelled', 'rescheduled'];

/**
 * Restore locked fields from the stored record so a crafted PATCH is a no-op
 * instead of an error — matches how assignment groups are handled.
 *
 * @param {core.Record} record
 * @param {core.Record} original
 * @param {string[]} fields
 */
function restoreFields(record, original, fields) {
  for (const name of fields) {
    record.set(name, original.get(name));
  }
}

/**
 * @param {core.Record} record
 * @returns {core.Record}
 */
function originalOf(record) {
  return typeof record.original === 'function' ? record.original() : record;
}

/**
 * @param {core.App} app
 * @param {core.RecordRequestEvent} e
 */
function assertLessonCreate(app, e) {
  const auth = e.auth;
  if (!auth) {
    throw new ApiError(403, 'Нет доступа');
  }
  if (!isUsersAuth(auth)) return;

  const role = auth.getString('role');

  // Students may only book for themselves.
  if (role === 'student') {
    e.record.set('student', auth.id);
  }

  const studentId = relId(e.record.get('student'));
  const teacherId = relId(e.record.get('teacher'));
  if (!studentId || !teacherId) {
    throw new ApiError(400, 'Укажите ученика и преподавателя');
  }

  const student = app.findRecordById('users', studentId);
  if (student.getString('role') !== 'student') {
    throw new ApiError(400, 'Занятие можно записать только на ученика');
  }

  const teacher = app.findRecordById('users', teacherId);
  const teacherRole = teacher.getString('role');
  if (teacherRole !== 'teacher' && teacherRole !== 'admin') {
    throw new ApiError(400, 'Занятие можно записать только к преподавателю');
  }

  // New lessons always start clean — no pre-seeded notes or status.
  e.record.set('status', 'scheduled');
  e.record.set('teacherNotes', '');
}

/**
 * @param {core.App} _app
 * @param {core.RecordRequestEvent} e
 */
function assertLessonUpdate(_app, e) {
  const auth = e.auth;
  if (!auth) {
    throw new ApiError(403, 'Нет доступа');
  }
  if (!isUsersAuth(auth)) return;

  const role = auth.getString('role');
  if (role === 'admin') return;

  const record = e.record;
  const original = originalOf(record);
  const studentId = relId(original.get('student'));
  const teacherId = relId(original.get('teacher'));

  if (role === 'teacher') {
    if (teacherId !== auth.id) {
      throw new ApiError(403, 'Нет доступа');
    }
    restoreFields(record, original, TEACHER_LOCKED_FIELDS);
    return;
  }

  if (studentId !== auth.id) {
    throw new ApiError(403, 'Нет доступа');
  }

  restoreFields(record, original, STUDENT_LOCKED_FIELDS);

  const status = record.getString('status');
  if (status !== original.getString('status') && STUDENT_ALLOWED_STATUSES.indexOf(status) === -1) {
    throw new ApiError(403, 'Ученик не может установить этот статус');
  }
}

module.exports = {
  assertLessonCreate,
  assertLessonUpdate,
  STUDENT_LOCKED_FIELDS,
  TEACHER_LOCKED_FIELDS,
};
