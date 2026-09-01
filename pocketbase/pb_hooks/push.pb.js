/// <reference path="../pb_data/types.d.ts" />

/**
 * ROADMAP 3.3 — push subscription hooks (own-row lock on create).
 */

onRecordCreateRequest((e) => {
  const pushModule = require(`${__hooks}/lib/kvartiraPush.js`);
  const auth = e.auth;
  if (!auth) {
    throw new ApiError(403, 'Нет доступа');
  }

  if (auth.collection().name === 'users' && auth.getString('role') !== 'admin') {
    e.record.set('user', auth.id);
  }

  const userId = pushModule.relId(e.record.get('user'));
  if (
    auth.collection().name === 'users' &&
    userId !== auth.id &&
    auth.getString('role') !== 'admin'
  ) {
    throw new ApiError(403, 'Нет доступа');
  }

  e.next();
}, 'push_subscriptions');
