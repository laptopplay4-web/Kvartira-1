/// <reference path="../pb_data/types.d.ts" />
/**
 * ROADMAP 2.7 — support ticket hooks:
 * - force user = auth on create (non-admin)
 * - admin-only adminReply/status on update
 */

onRecordCreateRequest((e) => {
  const support = require(`${__hooks}/lib/kvartiraSupport.js`);
  support.assertTicketCreate($app, e);
  e.next();
}, 'support_tickets');

onRecordUpdateRequest((e) => {
  const support = require(`${__hooks}/lib/kvartiraSupport.js`);
  support.assertTicketUpdate($app, e);
  e.next();
}, 'support_tickets');
