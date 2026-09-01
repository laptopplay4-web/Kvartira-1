/// <reference path="../pb_data/types.d.ts" />
/**
 * ROADMAP 3.1 — file storage hooks (owner lock, immutable metadata).
 */

onRecordCreateRequest((e) => {
  const files = require(`${__hooks}/lib/kvartiraFiles.js`);
  files.assertFileCreate($app, e);
  e.next();
}, 'kvartira_files');

onRecordUpdateRequest((e) => {
  const files = require(`${__hooks}/lib/kvartiraFiles.js`);
  files.assertFileUpdate($app, e);
  e.next();
}, 'kvartira_files');
