/// <reference path="../pb_data/types.d.ts" />

/**
 * ROADMAP 3.x — messages collection lacked `created`/`updated` autodate fields
 * (base schema without system timestamps). Chat UI and pagination depend on them.
 */

/** @param {import('pocketbase').CoreApp} app */
function addAutodateFields(app) {
  const col = app.findCollectionByNameOrId('messages');
  if (!col.fields.getByName('created')) {
    col.fields.add(
      new Field({
        name: 'created',
        type: 'autodate',
        required: false,
        onCreate: true,
        onUpdate: false,
      }),
    );
  }
  if (!col.fields.getByName('updated')) {
    col.fields.add(
      new Field({
        name: 'updated',
        type: 'autodate',
        required: false,
        onCreate: true,
        onUpdate: true,
      }),
    );
  }
  app.save(col);
}

/** @param {import('pocketbase').CoreApp} app */
function backfillMessageTimestamps(app) {
  const records = app.findRecordsByFilter('messages', 'id != ""');
  let index = 0;
  const baseMs = Date.parse('2026-01-01T00:00:00.000Z');
  for (const record of records) {
    const existing = record.get('created');
    if (existing) continue;
    const edited = record.get('editedAt');
    const iso = edited
      ? String(edited).includes('T')
        ? String(edited)
        : String(edited).replace(' ', 'T')
      : new Date(baseMs + index * 60_000).toISOString();
    record.set('created', iso);
    record.set('updated', iso);
    app.save(record);
    index += 1;
  }
}

/** @param {import('pocketbase').CoreApp} app */
function removeAutodateFields(app) {
  const col = app.findCollectionByNameOrId('messages');
  for (const name of ['created', 'updated']) {
    const field = col.fields.getByName(name);
    if (field) col.fields.removeById(field.id);
  }
  app.save(col);
}

migrate(
  (app) => {
    addAutodateFields(app);
    backfillMessageTimestamps(app);
  },
  (app) => {
    removeAutodateFields(app);
  },
);
