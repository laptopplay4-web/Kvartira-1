/// <reference path="../pb_data/types.d.ts" />

/**
 * Notifications: urgent flag for teacher directions setup and similar.
 */
migrate(
  (app) => {
    const notifications = app.findCollectionByNameOrId('notifications');
    if (!notifications.fields.getByName('urgent')) {
      notifications.fields.add(new Field({ name: 'urgent', type: 'bool' }));
    }
    app.save(notifications);
  },
  (app) => {
    const notifications = app.findCollectionByNameOrId('notifications');
    const urgent = notifications.fields.getByName('urgent');
    if (urgent) {
      notifications.fields.removeById(urgent.id);
    }
    app.save(notifications);
  },
);
