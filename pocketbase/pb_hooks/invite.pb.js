/// <reference path="../pb_data/types.d.ts" />

/**

 * Registration QR invite — validate endpoint + strip secret from public school_settings.

 */



onRecordEnrich((e) => {

  const invite = require(`${__hooks}/lib/kvartiraInvite.js`);

  invite.stripInviteFromSchoolSettingsRecord(e);

  e.next();

}, 'school_settings');



routerAdd('POST', '/api/kvartira/registration-invite/validate', (e) => {

  const invite = require(`${__hooks}/lib/kvartiraInvite.js`);

  const body = e.requestInfo().body || {};

  const token = String(body.token || '').trim();

  // A default seed token is treated as invalid outside development so the gate
  // screen appears instead of a registration form that would fail on submit.
  const isDefaultToken =
    !invite.isDevEnvironment() && token === invite.SEED_INVITE_TOKEN;

  const valid = !isDefaultToken && invite.isValidInviteToken($app, token);

  return e.json(200, { valid });

});


