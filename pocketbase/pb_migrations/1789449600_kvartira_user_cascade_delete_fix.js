/// <reference path="../pb_data/types.d.ts" />

/**
 * Fix user relation cascadeDelete (1789363200 was applied but fields stayed false).
 */

/**
 * @param {core.Collection} collection
 * @param {string[]} fieldNames
 */
function enableCascadeDelete(collection, fieldNames) {
  for (const name of fieldNames) {
    const field = collection.fields.getByName(name);
    if (!field) continue;
    field.cascadeDelete = true;
  }
}

migrate(
  (app) => {
    const lessons = app.findCollectionByNameOrId('lessons');
    enableCascadeDelete(lessons, ['student', 'teacher']);
    app.save(lessons);

    const lessonHistory = app.findCollectionByNameOrId('lesson_history');
    enableCascadeDelete(lessonHistory, ['user']);
    app.save(lessonHistory);

    const messages = app.findCollectionByNameOrId('messages');
    enableCascadeDelete(messages, ['sender']);
    app.save(messages);

    const assignments = app.findCollectionByNameOrId('assignments');
    enableCascadeDelete(assignments, ['teacher', 'group']);
    app.save(assignments);

    try {
      const groups = app.findCollectionByNameOrId('assignment_groups');
      enableCascadeDelete(groups, ['teacher']);
      app.save(groups);
    } catch (_) {
      /* collection may not exist in partial fixtures */
    }
  },
  (app) => {
    /**
     * @param {core.Collection} collection
     * @param {string[]} fieldNames
     */
    function disableCascadeDelete(collection, fieldNames) {
      for (const name of fieldNames) {
        const field = collection.fields.getByName(name);
        if (!field) continue;
        field.cascadeDelete = false;
      }
    }

    const lessons = app.findCollectionByNameOrId('lessons');
    disableCascadeDelete(lessons, ['student', 'teacher']);
    app.save(lessons);

    const lessonHistory = app.findCollectionByNameOrId('lesson_history');
    disableCascadeDelete(lessonHistory, ['user']);
    app.save(lessonHistory);

    const messages = app.findCollectionByNameOrId('messages');
    disableCascadeDelete(messages, ['sender']);
    app.save(messages);

    const assignments = app.findCollectionByNameOrId('assignments');
    disableCascadeDelete(assignments, ['teacher', 'group']);
    app.save(assignments);

    try {
      const groups = app.findCollectionByNameOrId('assignment_groups');
      disableCascadeDelete(groups, ['teacher']);
      app.save(groups);
    } catch (_) {
      /* collection may not exist */
    }
  },
);
