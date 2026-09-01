/// <reference path="../pb_data/types.d.ts" />

/**
 * ROADMAP 3.x — all custom base() collections lacked `created`/`updated` autodate.
 * Mappers and UI expect ISO timestamps on records (messages, notifications, etc.).
 */

const COLLECTIONS = [
  'lessons',
  'lesson_history',
  'conversations',
  'conversation_members',
  'messages',
  'event_registrations',
  'assignments',
  'student_skill_progress',
  'progress_goals',
  'progress_history',
  'support_tickets',
  'security_sessions',
  'login_history',
  'security_alerts',
  'notifications',
  'audit_logs',
  'kvartira_files',
  'push_subscriptions',
];

/** @param {import('pocketbase').CoreApp} app @param {string} name */
function ensureAutodateFields(app, name) {
  const col = app.findCollectionByNameOrId(name);
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

/** @param {import('pocketbase').CoreApp} app @param {string} name */
function backfillCollectionTimestamps(app, name) {
  let records;
  try {
    records = app.findRecordsByFilter(name, 'id != ""');
  } catch (_) {
    return;
  }

  let index = 0;
  const baseMs = Date.parse('2026-01-01T00:00:00.000Z');

  for (const record of records) {
    if (record.get('created')) continue;

    const edited = record.get('editedAt');
    const lastActive = record.get('lastActiveAt');
    const lastMessageAt = record.get('lastMessageAt');
    const dueDate = record.get('dueDate');
    const completedAt = record.get('completedAt');
    const lastReadAt = record.get('lastReadAt');
    const date = record.get('date');

    const hint =
      edited ||
      lastActive ||
      lastMessageAt ||
      completedAt ||
      lastReadAt ||
      dueDate ||
      date;

    const iso = hint
      ? String(hint).includes('T')
        ? String(hint)
        : String(hint).replace(' ', 'T')
      : new Date(baseMs + index * 60_000).toISOString();

    record.set('created', iso);
    record.set('updated', iso);
    app.save(record);
    index += 1;
  }
}

/** @param {import('pocketbase').CoreApp} app @param {string} name */
function removeAutodateFields(app, name) {
  try {
    const col = app.findCollectionByNameOrId(name);
    for (const fieldName of ['created', 'updated']) {
      const field = col.fields.getByName(fieldName);
      if (field) col.fields.removeById(field.id);
    }
    app.save(col);
  } catch (_) {
    /* collection may not exist on down */
  }
}

migrate(
  (app) => {
    for (const name of COLLECTIONS) {
      try {
        ensureAutodateFields(app, name);
        backfillCollectionTimestamps(app, name);
      } catch (_) {
        /* skip missing collections (e.g. audit before phase 4) */
      }
    }
  },
  (app) => {
    for (const name of COLLECTIONS) {
      removeAutodateFields(app, name);
    }
  },
);
