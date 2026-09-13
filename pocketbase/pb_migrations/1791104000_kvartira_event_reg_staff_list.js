/// <reference path="../pb_data/types.d.ts" />

/**
 * event_registrations: teachers can list roster; only students may create.
 */

const AUTH = '@request.auth.id != ""';
const ADMIN = '@request.auth.role = "admin"';
const TEACHER = '@request.auth.role = "teacher"';

const LIST_VIEW = `${ADMIN} || ${TEACHER} || user = @request.auth.id`;
const CREATE_STUDENT = `${AUTH} && user = @request.auth.id && @request.auth.role = "student"`;

const PREV_LIST = `${ADMIN} || user = @request.auth.id`;
const PREV_CREATE = `${ADMIN} || (${AUTH} && user = @request.auth.id)`;

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('event_registrations');
    col.listRule = LIST_VIEW;
    col.viewRule = LIST_VIEW;
    col.createRule = CREATE_STUDENT;
    app.save(col);
  },
  (app) => {
    const col = app.findCollectionByNameOrId('event_registrations');
    col.listRule = PREV_LIST;
    col.viewRule = PREV_LIST;
    col.createRule = PREV_CREATE;
    app.save(col);
  },
);
