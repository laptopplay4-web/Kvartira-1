/// @ts-check
/**
 * ROADMAP 3.3 — Web Push dispatch from PocketBase hooks.
 * Sends via optional WEB_PUSH_RELAY_URL (see pocketbase/push-relay.mjs).
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
function relId(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value) {
    return String(value.id);
  }
  return '';
}

/**
 * @param {core.App} app
 * @param {string} userId
 * @returns {boolean}
 */
function isPushEnabledForUser(app, userId) {
  try {
    const records = app.findRecordsByFilter(
      'notification_preferences',
      `user = "${userId}"`,
      '-id',
      1,
    );
    if (!records.length) return true;
    return records[0].getBool('pushEnabled');
  } catch (_) {
    return true;
  }
}

/**
 * @param {core.App} app
 * @param {string} userId
 * @returns {core.Record[]}
 */
function getSubscriptionsForUser(app, userId) {
  try {
    return app.findRecordsByFilter('push_subscriptions', `user = "${userId}"`, '-id', 50);
  } catch (_) {
    return [];
  }
}

/**
 * @param {core.Record} subscription
 * @param {{ title: string, body: string, link?: string }} payload
 */
function sendViaRelay(subscription, payload) {
  const relayUrl = $os.getenv('WEB_PUSH_RELAY_URL');
  if (!relayUrl) return false;

  const body = JSON.stringify({
    subscription: {
      endpoint: subscription.getString('endpoint'),
      keys: {
        p256dh: subscription.getString('p256dh'),
        auth: subscription.getString('auth'),
      },
    },
    payload,
  });

  const res = $http.send({
    url: relayUrl,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    timeout: 15,
  });

  return res.statusCode >= 200 && res.statusCode < 300;
}

/**
 * @param {core.App} app
 * @param {core.Record} subscription
 */
function removeSubscription(app, subscription) {
  try {
    app.delete(subscription);
  } catch (_) {
    /* ignore */
  }
}

/**
 * @param {core.App} app
 * @param {core.Record} notificationRecord
 */
function dispatchPushForNotification(app, notificationRecord) {
  const userId = relId(notificationRecord.get('user'));
  if (!userId) return;

  if (!isPushEnabledForUser(app, userId)) return;

  const relayUrl = $os.getenv('WEB_PUSH_RELAY_URL');
  if (!relayUrl) return;

  const payload = {
    title: notificationRecord.getString('title') || 'Квартира',
    body: notificationRecord.getString('body') || '',
    link: notificationRecord.getString('link') || '/',
  };

  const subscriptions = getSubscriptionsForUser(app, userId);
  for (const subscription of subscriptions) {
    try {
      const ok = sendViaRelay(subscription, payload);
      if (!ok) {
        app.logger().warn('[kvartiraPush] relay failed', 'endpoint', subscription.getString('endpoint'));
      }
    } catch (err) {
      const message = err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err);
      if (message.includes('410') || message.includes('404')) {
        removeSubscription(app, subscription);
      } else {
        app.logger().warn('[kvartiraPush] send error', 'message', message);
      }
    }
  }
}

module.exports = {
  relId,
  isPushEnabledForUser,
  getSubscriptionsForUser,
  dispatchPushForNotification,
};
