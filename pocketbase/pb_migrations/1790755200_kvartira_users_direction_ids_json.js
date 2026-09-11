/// <reference path="../pb_data/types.d.ts" />

/**
 * Ensure users.directionIds exists as JSON (teacher/student direction selection).
 * Manual Admin edits sometimes leave the field missing or as a wrong type.
 */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    const existing = users.fields.getByName('directionIds');
    if (!existing) {
      users.fields.add(new Field({ name: 'directionIds', type: 'json' }));
    } else if (existing.type !== 'json') {
      // Recreate as json — relation/select breaks app payloads (string[]).
      users.fields.removeById(existing.id);
      users.fields.add(new Field({ name: 'directionIds', type: 'json' }));
    }
    app.save(users);
  },
  (app) => {
    // Keep field on down — removing would wipe production selections.
    void app;
  },
);
