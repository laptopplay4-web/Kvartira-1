/// <reference path="../pb_data/types.d.ts" />

/**
 * ROADMAP 1.3 — auth collection config for phone-first login.
 * Email kept for PB auth identity fallback (synthetic @kvartira.local from hooks).
 */

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');

    const emailField = users.fields.getByName('email');
    if (emailField) {
      emailField.required = false;
    }

    const nameField = users.fields.getByName('name');
    if (nameField) {
      nameField.required = false;
    }

    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');

    const emailField = users.fields.getByName('email');
    if (emailField) {
      emailField.required = true;
    }

    app.save(users);
  },
);
