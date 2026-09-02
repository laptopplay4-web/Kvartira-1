/// @reference path="../pb_data/types.d.ts"
/**
 * Assignment + assignment_groups hooks:
 * teacher lock on create; groups immutable kind; no submit/review.
 */

onRecordCreateRequest((e) => {
  const assignments = require(`${__hooks}/lib/kvartiraAssignments.js`);
  assignments.assertAssignmentCreate($app, e);
  e.next();
}, 'assignments');

onRecordUpdateRequest((e) => {
  const assignments = require(`${__hooks}/lib/kvartiraAssignments.js`);
  assignments.assertAssignmentUpdate($app, e);
  e.next();
}, 'assignments');

onRecordCreateRequest((e) => {
  const assignments = require(`${__hooks}/lib/kvartiraAssignments.js`);
  assignments.assertAssignmentGroupCreate($app, e);
  e.next();
}, 'assignment_groups');

onRecordUpdateRequest((e) => {
  const assignments = require(`${__hooks}/lib/kvartiraAssignments.js`);
  assignments.assertAssignmentGroupUpdate($app, e);
  e.next();
}, 'assignment_groups');

onRecordDeleteRequest((e) => {
  const assignments = require(`${__hooks}/lib/kvartiraAssignments.js`);
  assignments.assertAssignmentGroupDelete($app, e);
  e.next();
}, 'assignment_groups');
