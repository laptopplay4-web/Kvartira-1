/// <reference path="../pb_data/types.d.ts" />

/**
 * avatarUrl / avatarOriginalUrl store pbfile: refs (see 1789708800).
 * Legacy migration: was max:0 (PB still applies 5000 default) — superseded by 1789708800.
 */

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    for (const name of ['avatarUrl', 'avatarOriginalUrl']) {
      const field = users.fields.getByName(name);
      if (!field || field.type !== 'text') continue;
      field.max = 255;
    }
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    for (const name of ['avatarUrl', 'avatarOriginalUrl']) {
      const field = users.fields.getByName(name);
      if (!field || field.type !== 'text') continue;
      field.max = 5000;
    }
    app.save(users);
  },
);
