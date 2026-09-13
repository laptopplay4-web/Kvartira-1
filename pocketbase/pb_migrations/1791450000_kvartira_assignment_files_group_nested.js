/// <reference path="../pb_data/types.d.ts" />
/**
 * Fix student access to assignment files (images/mp3).
 * Previous rule used broken `@collection.assignment_groups.id ?= @collection.assignments.group`.
 * Mirror ASSIGNMENT_ACCESS via `@collection.assignments.group.kind|name|members`.
 */

const ADMIN = '@request.auth.role = "admin"';

const FILE_ACCESS = `${ADMIN} || owner = @request.auth.id || purpose = "school" || purpose = "event" || (purpose = "chat" && contextId != "" && @collection.conversation_members.conversation ?= contextId && @collection.conversation_members.user ?= @request.auth.id) || (purpose = "assignment" && contextId != "" && @collection.assignments.id ?= contextId && (@collection.assignments.teacher ?= @request.auth.id || @collection.assignments.group.kind = "general" || @collection.assignments.group.name = "Все ученики" || @collection.assignments.group.members.id ?= @request.auth.id)) || (purpose = "support" && contextId != "" && @collection.support_tickets.id ?= contextId && (@collection.support_tickets.user ?= @request.auth.id || @request.auth.role = "admin"))`;

migrate(
  (app) => {
    const files = app.findCollectionByNameOrId('kvartira_files');
    files.listRule = FILE_ACCESS;
    files.viewRule = FILE_ACCESS;
    app.save(files);
  },
  (app) => {
    const files = app.findCollectionByNameOrId('kvartira_files');
    // previous (1791363200) — broken double @collection join
    const prev = `${ADMIN} || owner = @request.auth.id || purpose = "school" || purpose = "event" || (purpose = "chat" && contextId != "" && @collection.conversation_members.conversation ?= contextId && @collection.conversation_members.user ?= @request.auth.id) || (purpose = "assignment" && contextId != "" && @collection.assignments.id ?= contextId && (@collection.assignments.teacher ?= @request.auth.id || (@collection.assignment_groups.id ?= @collection.assignments.group && (@collection.assignment_groups.kind = "general" || @collection.assignment_groups.name = "Все ученики" || @collection.assignment_groups.members.id ?= @request.auth.id)))) || (purpose = "support" && contextId != "" && @collection.support_tickets.id ?= contextId && (@collection.support_tickets.user ?= @request.auth.id || @request.auth.role = "admin"))`;
    files.listRule = prev;
    files.viewRule = prev;
    app.save(files);
  },
);
