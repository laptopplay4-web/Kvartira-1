/// <reference path="../pb_data/types.d.ts" />
/**
 * ROADMAP 2.8 — legal hooks:
 * - consent create: own user + document metadata sync
 * - document update: lock type field (admin-only via RBAC)
 */

onRecordCreateRequest((e) => {
  const legal = require(`${__hooks}/lib/kvartiraLegal.js`);
  legal.assertConsentCreate($app, e);
  e.next();
}, 'user_consents');

onRecordUpdateRequest((e) => {
  const legal = require(`${__hooks}/lib/kvartiraLegal.js`);
  legal.assertLegalDocumentUpdate($app, e);
  e.next();
}, 'legal_documents');
