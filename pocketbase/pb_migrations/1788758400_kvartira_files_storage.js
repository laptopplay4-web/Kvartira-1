/// <reference path="../pb_data/types.d.ts" />

/**
 * ROADMAP 3.1 — kvartira_files collection + RBAC for chat/assignment/support uploads.
 * Rule fragments: pb_hooks/lib/kvartiraRbac.js (FILE_ACCESS)
 */

const AUTH = '@request.auth.id != ""';
const ADMIN = '@request.auth.role = "admin"';

const FILE_ACCESS = `${ADMIN} || owner = @request.auth.id || (purpose = "chat" && contextId != "" && @collection.conversation_members.conversation ?= contextId && @collection.conversation_members.user ?= @request.auth.id) || (purpose = "assignment" && contextId != "" && @collection.assignments.id ?= contextId && (@collection.assignments.student ?= @request.auth.id || @collection.assignments.teacher ?= @request.auth.id)) || (purpose = "support" && contextId != "" && @collection.support_tickets.id ?= contextId && (@collection.support_tickets.user ?= @request.auth.id || @request.auth.role = "admin"))`;

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

migrate(
  (app) => {
    const usersId = app.findCollectionByNameOrId('users').id;

    const collection = new Collection({
      name: 'kvartira_files',
      type: 'base',
      listRule: FILE_ACCESS,
      viewRule: FILE_ACCESS,
      createRule: `${AUTH} && owner = @request.auth.id`,
      updateRule: `${ADMIN} || owner = @request.auth.id`,
      deleteRule: `${ADMIN} || owner = @request.auth.id`,
      fields: [
        rel('owner', usersId, { required: true, cascadeDelete: true }),
        {
          name: 'purpose',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['chat', 'assignment', 'support'],
        },
        { name: 'contextId', type: 'text', max: 30 },
        { name: 'originalFilename', type: 'text', required: true, max: 255 },
        { name: 'mimeType', type: 'text', required: true, max: 120 },
        { name: 'size', type: 'number', required: true, min: 1 },
        {
          name: 'file',
          type: 'file',
          required: true,
          maxSelect: 1,
          maxSize: 104857600,
        },
      ],
      indexes: [
        'CREATE INDEX IF NOT EXISTS idx_kvartira_files_owner ON kvartira_files (owner)',
        'CREATE INDEX IF NOT EXISTS idx_kvartira_files_context ON kvartira_files (purpose, contextId)',
      ],
    });

    app.save(collection);
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('kvartira_files'));
    } catch (_) {
      /* not created */
    }
  },
);
