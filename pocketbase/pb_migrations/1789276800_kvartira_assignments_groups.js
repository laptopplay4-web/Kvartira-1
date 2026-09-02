/// <reference path="../pb_data/types.d.ts" />

/**
 * Groups + content blocks for assignments; public teacher list without phone leak.
 */

const AUTH = '@request.auth.id != ""';
const ADMIN = '@request.auth.role = "admin"';
const TEACHER = '@request.auth.role = "teacher"';

const ASSIGNMENT_ACCESS = `${ADMIN} || teacher = @request.auth.id || (@collection.assignment_groups.id ?= group && (@collection.assignment_groups.kind = "general" || @collection.assignment_groups.members.id ?= @request.auth.id))`;
const ASSIGNMENT_GROUP_ACCESS = `${ADMIN} || teacher = @request.auth.id || kind = "general" || members.id ?= @request.auth.id`;
const FILE_ACCESS = `${ADMIN} || owner = @request.auth.id || (purpose = "chat" && contextId != "" && @collection.conversation_members.conversation ?= contextId && @collection.conversation_members.user ?= @request.auth.id) || (purpose = "assignment" && contextId != "" && @collection.assignments.id ?= contextId && (@collection.assignments.teacher ?= @request.auth.id || (@collection.assignment_groups.id ?= @collection.assignments.group && (@collection.assignment_groups.kind = "general" || @collection.assignment_groups.members.id ?= @request.auth.id)))) || (purpose = "support" && contextId != "" && @collection.support_tickets.id ?= contextId && (@collection.support_tickets.user ?= @request.auth.id || @request.auth.role = "admin"))`;

/** @param {string} collectionId @param {object} [opts] */
function rel(name, collectionId, opts = {}) {
  return {
    name,
    type: 'relation',
    required: opts.required ?? false,
    collectionId,
    maxSelect: opts.maxSelect ?? 1,
    cascadeDelete: opts.cascadeDelete ?? false,
  };
}

function autodateFields() {
  return [
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
  ];
}

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    const usersId = users.id;
    users.listRule = `${AUTH} || role = "teacher"`;
    users.viewRule = `${AUTH} || role = "teacher"`;
    app.save(users);

    let groupsCol;
    try {
      groupsCol = app.findCollectionByNameOrId('assignment_groups');
    } catch (_) {
      groupsCol = null;
    }
    if (!groupsCol) {
      app.save(
        new Collection({
          name: 'assignment_groups',
          type: 'base',
          listRule: ASSIGNMENT_GROUP_ACCESS,
          viewRule: ASSIGNMENT_GROUP_ACCESS,
          createRule: `${ADMIN} || (${TEACHER} && teacher = @request.auth.id)`,
          updateRule: `${ADMIN} || (${TEACHER} && teacher = @request.auth.id)`,
          deleteRule: `${ADMIN} || (${TEACHER} && teacher = @request.auth.id)`,
          fields: [
            { name: 'name', type: 'text', required: true, max: 120 },
            rel('teacher', usersId, { required: true }),
            {
              name: 'kind',
              type: 'select',
              required: true,
              maxSelect: 1,
              values: ['general', 'custom'],
            },
            rel('members', usersId, { maxSelect: 200 }),
            ...autodateFields(),
          ],
        }),
      );
    }

    const groupsId = app.findCollectionByNameOrId('assignment_groups').id;
    const assignments = app.findCollectionByNameOrId('assignments');

    if (!assignments.fields.getByName('group')) {
      assignments.fields.add(new Field(rel('group', groupsId, { required: true })));
    }
    if (!assignments.fields.getByName('contentBlocks')) {
      assignments.fields.add(new Field({ name: 'contentBlocks', type: 'json' }));
    }

    for (const name of ['student', 'dueDate', 'responseType', 'status']) {
      const field = assignments.fields.getByName(name);
      if (field) field.required = false;
    }
    app.save(assignments);

    for (const name of ['student', 'lesson', 'responseType', 'status', 'materials', 'submission', 'feedback']) {
      const field = assignments.fields.getByName(name);
      if (field) assignments.fields.removeById(field.id);
    }
    assignments.listRule = ASSIGNMENT_ACCESS;
    assignments.viewRule = ASSIGNMENT_ACCESS;
    assignments.createRule = `${ADMIN} || (${TEACHER} && teacher = @request.auth.id)`;
    assignments.updateRule = ASSIGNMENT_ACCESS;
    assignments.deleteRule = `${ADMIN} || (${TEACHER} && teacher = @request.auth.id)`;
    app.save(assignments);

    try {
      const files = app.findCollectionByNameOrId('kvartira_files');
      files.listRule = FILE_ACCESS;
      files.viewRule = FILE_ACCESS;
      app.save(files);
    } catch (_) {
      /* collection may not exist in partial test fixtures */
    }
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.listRule = AUTH;
    users.viewRule = AUTH;
    app.save(users);

    try {
      app.delete(app.findCollectionByNameOrId('assignment_groups'));
    } catch (_) {
      /* already gone */
    }
  },
);
