/// <reference path="../pb_data/types.d.ts" />

/**
 * notification_preferences.pushEnabled was required bool — PocketBase treats
 * JSON/hook `false` as blank on required bools, so toggling push OFF failed.
 */

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('notification_preferences');
    const field = col.fields.getByName('pushEnabled');
    if (field) {
      field.required = false;
    }
    app.save(col);
  },
  (app) => {
    const col = app.findCollectionByNameOrId('notification_preferences');
    const field = col.fields.getByName('pushEnabled');
    if (field) {
      field.required = true;
    }
    app.save(col);
  },
);
