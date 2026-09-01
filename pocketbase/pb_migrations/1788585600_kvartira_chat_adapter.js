/// <reference path="../pb_data/types.d.ts" />

/**
 * ROADMAP 2.4 — chat adapter RBAC:
 * conversation owner/admin can remove other members (group management).
 * Leave-own remains: user = @request.auth.id.
 */

migrate(
  (app) => {
    const members = app.findCollectionByNameOrId('conversation_members');
    members.deleteRule =
      '@request.auth.role = "admin" || user = @request.auth.id || (@collection.conversation_members.conversation ?= conversation && @collection.conversation_members.user ?= @request.auth.id && (@collection.conversation_members.role ?= "owner" || @collection.conversation_members.role ?= "admin"))';
    app.save(members);
  },
  (app) => {
    const members = app.findCollectionByNameOrId('conversation_members');
    members.deleteRule =
      '@request.auth.role = "admin" || user = @request.auth.id';
    app.save(members);
  },
);
