/// <reference path="../pb_data/types.d.ts" />
/**
 * ROADMAP 2.5 — assignment hooks:
 * - force teacher = auth on create (non-admin)
 * - student submit / teacher review field lock on update
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
