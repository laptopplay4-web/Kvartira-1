/// @reference path="../pb_data/types.d.ts"
/**
 * Lesson hooks: participant field locks + `teacherNotes` visibility.
 *
 * `teacherNotes` are private staff notes about a student. PB rules let both
 * participants read the record, so the field is stripped for students here —
 * `sanitizeLessonForViewer` on the client is UI-only and bypassable.
 */

onRecordEnrich((e) => {
  const auth = e.auth;
  if (!auth) {
    e.record.hide('teacherNotes');
    e.next();
    return;
  }

  let isStaff = false;
  try {
    const role = auth.getString('role');
    isStaff = role === 'teacher' || role === 'admin';
  } catch (_) {
    isStaff = false;
  }

  if (!isStaff) {
    e.record.hide('teacherNotes');
  }
  e.next();
}, 'lessons');

onRecordCreateRequest((e) => {
  const lessons = require(`${__hooks}/lib/kvartiraLessons.js`);
  lessons.assertLessonCreate($app, e);
  e.next();
}, 'lessons');

onRecordUpdateRequest((e) => {
  const lessons = require(`${__hooks}/lib/kvartiraLessons.js`);
  lessons.assertLessonUpdate($app, e);
  e.next();
}, 'lessons');
