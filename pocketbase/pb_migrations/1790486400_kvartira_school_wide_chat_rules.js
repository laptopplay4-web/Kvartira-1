/// <reference path="../pb_data/types.d.ts" />
/**
 * School-wide chats: list/view without prior membership (metadata.schoolWide).
 * Keep in sync with pb_hooks/lib/kvartiraRbac.js COLLECTION_RULES.conversations.
 */
migrate(
  (app) => {
    const ADMIN = '@request.auth.role = "admin"';
    const CONVERSATION_MEMBER = `${ADMIN} || (@collection.conversation_members.conversation ?= id && @collection.conversation_members.user ?= @request.auth.id)`;
    const col = app.findCollectionByNameOrId('conversations');
    col.listRule = `${ADMIN} || ${CONVERSATION_MEMBER} || metadata.schoolWide = true`;
    col.viewRule = `${ADMIN} || ${CONVERSATION_MEMBER} || metadata.schoolWide = true`;
    app.save(col);
  },
  (app) => {
    const ADMIN = '@request.auth.role = "admin"';
    const CONVERSATION_MEMBER = `${ADMIN} || (@collection.conversation_members.conversation ?= id && @collection.conversation_members.user ?= @request.auth.id)`;
    const col = app.findCollectionByNameOrId('conversations');
    col.listRule = CONVERSATION_MEMBER;
    col.viewRule = CONVERSATION_MEMBER;
    app.save(col);
  },
);
