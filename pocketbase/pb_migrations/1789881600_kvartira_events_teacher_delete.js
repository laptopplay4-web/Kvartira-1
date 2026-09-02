/// <reference path="../pb_data/types.d.ts" />

/**
 * Events CRUD: teachers may delete school events (same as create/update).
 * UI: /events (+ create, detail edit/delete).
 */
migrate(
  (app) => {
    const events = app.findCollectionByNameOrId('events');
    events.deleteRule =
      '@request.auth.role = "admin" || @request.auth.role = "teacher"';
    app.save(events);
  },
  (app) => {
    const events = app.findCollectionByNameOrId('events');
    events.deleteRule = '@request.auth.role = "admin"';
    app.save(events);
  },
);
