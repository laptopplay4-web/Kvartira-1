/// <reference path="../pb_data/types.d.ts" />
/**
 * ROADMAP 2.1 — authenticated users can list/view profiles (lessons, chat, assignments UI).
 * Phone remains in API; UI hides it outside /admin/users.
 */

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.listRule = '@request.auth.id != ""';
    users.viewRule = '@request.auth.id != ""';
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.listRule = '@request.auth.role = "admin"';
    users.viewRule = '@request.auth.role = "admin" || id = @request.auth.id';
    app.save(users);
  },
);
