/**
 * YClients webhook helpers (stub until credentials + live sync).
 *
 * Env:
 *   YCLIENTS_WEBHOOK_SECRET — required for accepting webhooks
 *   YCLIENTS_COMPANY_ID / YCLIENTS_TOKEN — reserved for outbound API (not used yet)
 */

function readEnv(name) {
  try {
    if (typeof $os !== 'undefined' && $os.getenv) {
      return String($os.getenv(name) || '').trim();
    }
  } catch {
    /* ignore */
  }
  return '';
}

function isYclientsSyncConfigured() {
  return Boolean(readEnv('YCLIENTS_WEBHOOK_SECRET'));
}

/**
 * @param {string} provided
 * @returns {boolean}
 */
function verifyWebhookSecret(provided) {
  const expected = readEnv('YCLIENTS_WEBHOOK_SECRET');
  if (!expected) return false;
  return String(provided || '').trim() === expected;
}

/**
 * Placeholder inbound handler. Returns accepted:false until live mapping lands.
 * @param {object} _payload
 * @returns {{ accepted: boolean, reason: string }}
 */
function handleWebhookPayload(_payload) {
  return {
    accepted: false,
    reason: 'YClients sync not implemented yet — foundation stub',
  };
}

module.exports = {
  isYclientsSyncConfigured,
  verifyWebhookSecret,
  handleWebhookPayload,
  readEnv,
};
