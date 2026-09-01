/// <reference path="../pb_data/types.d.ts" />
/**
 * ROADMAP 2.6 — progress hooks:
 * teacher may only write progress for assigned students;
 * student may only create own achievement / history rows.
 */

onRecordCreateRequest((e) => {
  const progress = require(`${__hooks}/lib/kvartiraProgress.js`);
  progress.assertProgressCreate($app, e);
  if (e.auth && e.auth.collection().name === 'users' && e.auth.getString('role') === 'teacher') {
    e.record.set('teacher', e.auth.id);
  }
  e.next();
}, 'progress_goals');

onRecordUpdateRequest((e) => {
  const progress = require(`${__hooks}/lib/kvartiraProgress.js`);
  progress.assertProgressUpdate($app, e);
  e.next();
}, 'progress_goals');

onRecordCreateRequest((e) => {
  const progress = require(`${__hooks}/lib/kvartiraProgress.js`);
  progress.assertProgressCreate($app, e);
  e.next();
}, 'student_skill_progress');

onRecordUpdateRequest((e) => {
  const progress = require(`${__hooks}/lib/kvartiraProgress.js`);
  progress.assertProgressUpdate($app, e);
  e.next();
}, 'student_skill_progress');

onRecordCreateRequest((e) => {
  const progress = require(`${__hooks}/lib/kvartiraProgress.js`);
  progress.assertProgressCreate($app, e);
  e.next();
}, 'progress_history');

onRecordCreateRequest((e) => {
  const progress = require(`${__hooks}/lib/kvartiraProgress.js`);
  progress.assertProgressCreate($app, e);
  e.next();
}, 'user_achievements');
