/// <reference path="../pb_data/types.d.ts" />

/**
 * conversations.avatarUrl was `url` — rejects data: and pbfile: refs.
 * Store short pbfile: refs (kvartira_files purpose=chat), like user avatars.
 */

const AVATAR_REF_MAX = 255;

migrate(
  (app) => {
    const conversations = app.findCollectionByNameOrId('conversations');
    const field = conversations.fields.getByName('avatarUrl');
    if (!field) {
      conversations.fields.add(
        new Field({ name: 'avatarUrl', type: 'text', required: false, max: AVATAR_REF_MAX }),
      );
    } else if (field.type === 'url') {
      conversations.fields.removeById(field.id);
      conversations.fields.add(
        new Field({ name: 'avatarUrl', type: 'text', required: false, max: AVATAR_REF_MAX }),
      );
    } else if (field.type === 'text') {
      field.max = AVATAR_REF_MAX;
    }
    app.save(conversations);
  },
  (app) => {
    const conversations = app.findCollectionByNameOrId('conversations');
    const field = conversations.fields.getByName('avatarUrl');
    if (!field || field.type !== 'text') return;
    conversations.fields.removeById(field.id);
    conversations.fields.add(new Field({ name: 'avatarUrl', type: 'url', required: false }));
    app.save(conversations);
  },
);
