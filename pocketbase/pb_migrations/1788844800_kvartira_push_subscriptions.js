/// <reference path="../pb_data/types.d.ts" />

/**
 * ROADMAP 3.3 — push_subscriptions collection + RBAC (own-row only).
 */

const AUTH = '@request.auth.id != ""';
const ADMIN = '@request.auth.role = "admin"';
const OWN = `${ADMIN} || user = @request.auth.id`;

/** @param {string} name @param {string} collectionId @param {object} [opts] */
function rel(name, collectionId, opts = {}) {
  return {
    name,
    type: 'relation',
    required: opts.required ?? false,
    collectionId,
    maxSelect: opts.maxSelect ?? 1,
    cascadeDelete: opts.cascadeDelete ?? false,
  };
}

migrate(
  (app) => {
    const usersId = app.findCollectionByNameOrId('users').id;

    const collection = new Collection({
      name: 'push_subscriptions',
      type: 'base',
      listRule: OWN,
      viewRule: OWN,
      createRule: `${AUTH} && user = @request.auth.id`,
      updateRule: OWN,
      deleteRule: OWN,
      fields: [
        rel('user', usersId, { required: true, cascadeDelete: true }),
        { name: 'endpoint', type: 'text', required: true, max: 2048 },
        { name: 'p256dh', type: 'text', required: true, max: 512 },
        { name: 'auth', type: 'text', required: true, max: 512 },
        { name: 'userAgent', type: 'text', max: 512 },
      ],
      indexes: [
        'CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user)',
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions (endpoint)',
      ],
    });

    app.save(collection);
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('push_subscriptions'));
    } catch (_) {
      /* not created */
    }
  },
);
