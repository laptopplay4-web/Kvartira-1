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

/**
 * Withdraw consent (152-ФЗ, ст. 9 ч. 2).
 *
 * `user_consents` has no update rule on purpose: the journal must only be
 * changed here, where the server owns the timestamp and writes the audit entry.
 */
routerAdd('POST', '/api/kvartira/consents/revoke', (e) => {
  const legal = require(`${__hooks}/lib/kvartiraLegal.js`);
  const audit = require(`${__hooks}/lib/kvartiraAudit.js`);

  const body = e.requestInfo().body || {};
  const consentId = String(body.consentId || '').trim();
  if (!consentId) {
    throw new ApiError(400, 'Укажите согласие');
  }

  const consent = legal.revokeConsentRecord($app, e, consentId);

  audit.logConsentEvent($app, e, 'consent.revoked', consent);

  return e.json(200, consent);
});

onRecordAfterCreateSuccess((e) => {
  const audit = require(`${__hooks}/lib/kvartiraAudit.js`);
  audit.logConsentEvent($app, e, 'consent.accepted', e.record);
  e.next();
}, 'user_consents');

/**
 * Empty production DB → registration /legal fail without seed.
 * Create missing consent docs on serve (idempotent; never overwrites existing).
 */
onBootstrap((e) => {
  e.next();
  try {
    const bootstrap = require(`${__hooks}/lib/kvartiraLegalBootstrap.js`);
    const result = bootstrap.ensureRequiredLegalDocuments($app);
    if (result.created > 0) {
      console.log(`[kvartira] legal bootstrap: created ${result.created} document(s)`);
    }
  } catch (err) {
    console.log('[kvartira] legal bootstrap failed:', err);
  }
});
