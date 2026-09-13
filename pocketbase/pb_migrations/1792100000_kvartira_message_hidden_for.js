/// <reference path="../pb_data/types.d.ts" />

/**
 * Per-user hide list for «Удалить у себя» (message stays for other participants).
 */

migrate(
  (app) => {
    const messages = app.findCollectionByNameOrId('messages');
    if (!messages.fields.getByName('hiddenForUserIds')) {
      messages.fields.add(new Field({ name: 'hiddenForUserIds', type: 'json', required: false }));
    }
    app.save(messages);
  },
  (app) => {
    const messages = app.findCollectionByNameOrId('messages');
    const field = messages.fields.getByName('hiddenForUserIds');
    if (!field) return;
    messages.fields.removeById(field.id);
    app.save(messages);
  },
);
