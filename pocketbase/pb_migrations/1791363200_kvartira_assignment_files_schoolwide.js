/// <reference path="../pb_data/types.d.ts" />
/**
 * Assignment file access for school-wide groups (name «Все ученики»)
 * — students could list the assignment but not resolve pbfile: images/mp3.
 */

const ADMIN = '@request.auth.role = "admin"';

const FILE_ACCESS = `${ADMIN} || owner = @request.auth.id || purpose = "school" || purpose = "event" || (purpose = "chat" && contextId != "" && @collection.conversation_members.conversation ?= contextId && @collection.conversation_members.user ?= @request.auth.id) || (purpose = "assignment" && contextId != "" && @collection.assignments.id ?= contextId && (@collection.assignments.teacher ?= @request.auth.id || (@collection.assignment_groups.id ?= @collection.assignments.group && (@collection.assignment_groups.kind = "general" || @collection.assignment_groups.name = "Все ученики" || @collection.assignment_groups.members.id ?= @request.auth.id)))) || (purpose = "support" && contextId != "" && @collection.support_tickets.id ?= contextId && (@collection.support_tickets.user ?= @request.auth.id || @request.auth.role = "admin"))`;

migrate(
  (app) => {
    const files = app.findCollectionByNameOrId('kvartira_files');
    files.listRule = FILE_ACCESS;
    files.viewRule = FILE_ACCESS;
    app.save(files);
  },
  (app) => {
    const files = app.findCollectionByNameOrId('kvartira_files');
    // previous rule from 1791017600 (without school-wide name)
    const prev = `${ADMIN} || owner = @request.auth.id || purpose = "school" || purpose = "event" || (purpose = "chat" && contextId != "" && @collection.conversation_members.conversation ?= contextId && @collection.conversation_members.user ?= @request.auth.id) || (purpose = "assignment" && contextId != "" && @collection.assignments.id ?= contextId && (@collection.assignments.teacher ?= @request.auth.id || (@collection.assignment_groups.id ?= @collection.assignments.group && (@collection.assignment_groups.kind = "general" || @collection.assignment_groups.members.id ?= @request.auth.id)))) || (purpose = "support" && contextId != "" && @collection.support_tickets.id ?= contextId && (@collection.support_tickets.user ?= @request.auth.id || @request.auth.role = "admin"))`;
    files.listRule = prev;
    files.viewRule = prev;
    app.save(files);
  },
);
