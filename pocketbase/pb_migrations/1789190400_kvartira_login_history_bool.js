/// <reference path="../pb_data/types.d.ts" />

/**
 * login_history.success is required bool — JSVM `false` is treated as blank
 * and failed-login history writes abort auth-with-password.
 */

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('login_history');
    const field = col.fields.getByName('success');
    if (field) {
      field.required = false;
    }
    app.save(col);
  },
  (app) => {
    const col = app.findCollectionByNameOrId('login_history');
    const field = col.fields.getByName('success');
    if (field) {
      field.required = true;
    }
    app.save(col);
  },
);
