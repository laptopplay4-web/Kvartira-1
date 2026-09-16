/// <reference path="../pb_data/types.d.ts" />

/**
 * YClients webhook stub — verify secret, 501 until live sync is enabled.
 * POST /api/kvartira/yclients/webhook
 */

routerAdd('POST', '/api/kvartira/yclients/webhook', (e) => {
  const yclients = require(`${__hooks}/lib/kvartiraYclients.js`);

  if (!yclients.isYclientsSyncConfigured()) {
    return e.json(501, {
      error: 'YClients sync is not configured',
      code: 'YCLIENTS_DISABLED',
    });
  }

  const info = e.requestInfo() || {};
  const headers = info.headers || {};
  const body = info.body || {};
  const secret =
    headers['x_yclients_secret'] ||
    headers['x-yclients-secret'] ||
    headers['X-YClients-Secret'] ||
    body.secret ||
    '';

  if (!yclients.verifyWebhookSecret(secret)) {
    return e.json(401, { error: 'Invalid webhook secret', code: 'UNAUTHORIZED' });
  }

  const result = yclients.handleWebhookPayload(body);
  return e.json(202, {
    accepted: result.accepted,
    reason: result.reason,
  });
});
