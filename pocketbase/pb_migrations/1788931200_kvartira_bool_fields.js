/// <reference path="../pb_data/types.d.ts" />

/**
 * PocketBase treats JSON/hook `false` on required bool fields as blank.
 * Make common bool fields optional (default false) for hooks + seed API.
 */

/** @param {string} name @param {string} fieldName */
function relaxBoolField(app, name, fieldName) {
  const col = app.findCollectionByNameOrId(name);
  const field = col.fields.getByName(fieldName);
  if (field) {
    field.required = false;
  }
  app.save(col);
}

migrate(
  (app) => {
    relaxBoolField(app, 'security_alerts', 'read');
    relaxBoolField(app, 'notifications', 'read');
    relaxBoolField(app, 'conversation_members', 'muted');
    relaxBoolField(app, 'security_sessions', 'isCurrent');
  },
  (app) => {
    const restore = (collectionName, fieldName) => {
      const col = app.findCollectionByNameOrId(collectionName);
      const field = col.fields.getByName(fieldName);
      if (field) field.required = true;
      app.save(col);
    };
    restore('security_alerts', 'read');
    restore('notifications', 'read');
    restore('conversation_members', 'muted');
    restore('security_sessions', 'isCurrent');
  },
);
