/// <reference path="../pb_data/types.d.ts" />
/**
 * ROADMAP 2.9 — security hooks:
 * - session create/update: own user only, lock user field
 * - alert update: only read flag may change for own alerts
 */

onRecordCreateRequest((e) => {
  const securityModule = require(`${__hooks}/lib/kvartiraSecurity.js`);
  securityModule.assertSecuritySessionCreate(e);
  e.next();
}, 'security_sessions');

onRecordUpdateRequest((e) => {
  const securityModule = require(`${__hooks}/lib/kvartiraSecurity.js`);
  securityModule.assertSecuritySessionUpdate(e);
  e.next();
}, 'security_sessions');

onRecordUpdateRequest((e) => {
  const securityModule = require(`${__hooks}/lib/kvartiraSecurity.js`);
  securityModule.assertSecurityAlertUpdate(e);
  e.next();
}, 'security_alerts');
