/// <reference path="../pb_data/types.d.ts" />

/**
 * event_registrations.event cascadeDelete — otherwise deleting an event with
 * registrations fails: "not part of a required relation reference".
 * Also allow teacher|admin to delete registrations (staff event cleanup).
 */

const AUTH = '@request.auth.id != ""';
const ADMIN = '@request.auth.role = "admin"';
const TEACHER = '@request.auth.role = "teacher"';

const LIST_VIEW = `${ADMIN} || ${TEACHER} || user = @request.auth.id`;
const DELETE_STAFF = `${ADMIN} || ${TEACHER} || user = @request.auth.id`;
const PREV_DELETE = `${ADMIN} || user = @request.auth.id`;

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('event_registrations');
    const eventField = col.fields.getByName('event');
    if (eventField) {
      eventField.cascadeDelete = true;
    }
    col.deleteRule = DELETE_STAFF;
    col.listRule = LIST_VIEW;
    col.viewRule = LIST_VIEW;
    app.save(col);
  },
  (app) => {
    const col = app.findCollectionByNameOrId('event_registrations');
    const eventField = col.fields.getByName('event');
    if (eventField) {
      eventField.cascadeDelete = false;
    }
    col.deleteRule = PREV_DELETE;
    app.save(col);
  },
);

