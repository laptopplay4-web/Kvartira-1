/// <reference path="../pb_data/types.d.ts" />

/**
 * avatarUrl / avatarOriginalUrl store data:image/... base64 (client crop upload).
 * PB `url` fields reject data URLs — use `text` instead.
 */

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    for (const name of ['avatarUrl', 'avatarOriginalUrl']) {
      const field = users.fields.getByName(name);
      if (!field || field.type === 'text') continue;
      users.fields.removeById(field.id);
      users.fields.add(new Field({ name, type: 'text', required: false, max: 255 }));
    }
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    for (const name of ['avatarUrl', 'avatarOriginalUrl']) {
      const field = users.fields.getByName(name);
      if (!field || field.type === 'url') continue;
      users.fields.removeById(field.id);
      users.fields.add(new Field({ name, type: 'url', required: false }));
    }
    app.save(users);
  },
);
