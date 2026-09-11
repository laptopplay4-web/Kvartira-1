/// <reference path="../pb_data/types.d.ts" />
/**
 * Security sessions: tokenFingerprint for multi-device isCurrent matching.
 * Each login creates its own row; fingerprint ties UI "current" to this JWT.
 */
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('security_sessions');
    if (!collection) return;

    if (!collection.fields.getByName('tokenFingerprint')) {
      collection.fields.add(
        new Field({
          type: 'text',
          name: 'tokenFingerprint',
          required: false,
          max: 64,
        }),
      );
    }

    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('security_sessions');
    if (!collection) return;

    const field = collection.fields.getByName('tokenFingerprint');
    if (field) {
      collection.fields.removeById(field.id);
      app.save(collection);
    }
  },
);
