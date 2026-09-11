/// <reference path="../pb_data/types.d.ts" />

/**
 * Keep message history when a user account is deleted.
 * Personal chats remain for the other participant; sender is cleared (optional).
 * conversation_members.user still cascades (user leaves all chats).
 */

migrate(
  (app) => {
    const messages = app.findCollectionByNameOrId('messages');
    const sender = messages.fields.getByName('sender');
    if (sender) {
      sender.required = false;
      sender.cascadeDelete = false;
    }
    app.save(messages);
  },
  (app) => {
    const messages = app.findCollectionByNameOrId('messages');
    const sender = messages.fields.getByName('sender');
    if (sender) {
      sender.required = true;
      sender.cascadeDelete = true;
    }
    app.save(messages);
  },
);
