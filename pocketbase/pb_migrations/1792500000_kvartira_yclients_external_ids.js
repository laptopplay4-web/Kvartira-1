/// <reference path="../pb_data/types.d.ts" />

/**
 * YClients sync foundation: externalSource + externalId on lessons/users.
 * Unique index on lessons (externalSource, externalId) for upsert by remote id.
 */

migrate(
  (app) => {
    const lessons = app.findCollectionByNameOrId('lessons');

    if (!lessons.fields.getByName('externalSource')) {
      lessons.fields.add(
        new Field({
          name: 'externalSource',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: ['yclients'],
        }),
      );
    }

    if (!lessons.fields.getByName('externalId')) {
      lessons.fields.add(
        new Field({
          name: 'externalId',
          type: 'text',
          required: false,
          max: 128,
        }),
      );
    }

    const lessonIndexes = lessons.indexes || [];
    if (!lessonIndexes.some((idx) => String(idx).includes('idx_lessons_external'))) {
      lessons.indexes = [
        ...lessonIndexes,
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_lessons_external ON lessons (externalSource, externalId)',
      ];
    }

    app.save(lessons);

    const users = app.findCollectionByNameOrId('users');

    if (!users.fields.getByName('externalSource')) {
      users.fields.add(
        new Field({
          name: 'externalSource',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: ['yclients'],
        }),
      );
    }

    if (!users.fields.getByName('externalId')) {
      users.fields.add(
        new Field({
          name: 'externalId',
          type: 'text',
          required: false,
          max: 128,
        }),
      );
    }

    app.save(users);
  },
  (app) => {
    const lessons = app.findCollectionByNameOrId('lessons');
    const lessonSource = lessons.fields.getByName('externalSource');
    if (lessonSource) lessons.fields.removeById(lessonSource.id);
    const lessonExtId = lessons.fields.getByName('externalId');
    if (lessonExtId) lessons.fields.removeById(lessonExtId.id);
    lessons.indexes = (lessons.indexes || []).filter(
      (idx) => !String(idx).includes('idx_lessons_external'),
    );
    app.save(lessons);

    const users = app.findCollectionByNameOrId('users');
    const userSource = users.fields.getByName('externalSource');
    if (userSource) users.fields.removeById(userSource.id);
    const userExtId = users.fields.getByName('externalId');
    if (userExtId) users.fields.removeById(userExtId.id);
    app.save(users);
  },
);
